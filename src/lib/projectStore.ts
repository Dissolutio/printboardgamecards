import {
  parseProject,
  type ProjectFile,
} from './project.ts'

const DATABASE_NAME = 'printboardgamecards'
const PROJECT_KEY = 'current'
const IMAGE_HASH_PATTERN = /^[a-f0-9]{64}$/

type StoredProject = {
  project: unknown
  savedAt: number
}

export interface ProjectStoreStorage {
  readProject(): Promise<unknown | undefined>
  readImage(hash: string): Promise<Blob | undefined>
  writeProject(
    project: StoredProject,
    images: ReadonlyMap<string, Blob>,
    referencedHashes: ReadonlySet<string>,
  ): Promise<void>
  clear(): Promise<void>
}

export type ProjectStoreOptions = {
  createObjectURL?: (blob: Blob) => string
  revokeObjectURL?: (url: string) => void
  digest?: (blob: Blob) => Promise<string>
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'))
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'))
  })
}

let databasePromise: Promise<IDBDatabase> | undefined

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available.'))
  }

  const promise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains('projects')) {
        database.createObjectStore('projects')
      }
      if (!database.objectStoreNames.contains('images')) {
        database.createObjectStore('images')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open project storage.'))
    request.onblocked = () => reject(new Error('Project storage is blocked.'))
  }).catch((error: unknown) => {
    databasePromise = undefined
    throw error
  })
  databasePromise = promise
  return promise
}

const indexedDbStorage: ProjectStoreStorage = {
  async readProject() {
    const database = await openDatabase()
    const transaction = database.transaction('projects', 'readonly')
    const done = transactionDone(transaction)
    const project = await requestResult(transaction.objectStore('projects').get(PROJECT_KEY))
    await done
    return project as unknown | undefined
  },

  async readImage(hash) {
    const database = await openDatabase()
    const transaction = database.transaction('images', 'readonly')
    const done = transactionDone(transaction)
    const image = await requestResult(transaction.objectStore('images').get(hash))
    await done
    return image as Blob | undefined
  },

  async writeProject(project, images, referencedHashes) {
    const database = await openDatabase()
    const transaction = database.transaction(['projects', 'images'], 'readwrite')
    const done = transactionDone(transaction)
    const projectStore = transaction.objectStore('projects')
    const imageStore = transaction.objectStore('images')
    projectStore.put(project, PROJECT_KEY)
    for (const [hash, image] of images) imageStore.put(image, hash)

    const imageKeys = await requestResult(imageStore.getAllKeys())
    for (const key of imageKeys) {
      if (typeof key === 'string' && !referencedHashes.has(key)) imageStore.delete(key)
    }
    await done
  },

  async clear() {
    const database = await openDatabase()
    const transaction = database.transaction(['projects', 'images'], 'readwrite')
    const done = transactionDone(transaction)
    transaction.objectStore('projects').clear()
    transaction.objectStore('images').clear()
    await done
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function hashBlob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function replaceProjectSources(
  project: ProjectFile,
  sourceForHash: (hash: string) => string,
): { project: ProjectFile; hashes: Set<string> } {
  const hashes = new Set<string>()
  const cards = project.cards.map((card) => {
    const nextCard = { ...card }
    for (const side of ['front', 'back'] as const) {
      const sourceKey = side === 'front' ? 'frontSrc' : 'backSrc'
      const source: unknown = nextCard[sourceKey]
      if (source === undefined || typeof source === 'string') continue
      if (!isRecord(source) || typeof source.hash !== 'string' || !IMAGE_HASH_PATTERN.test(source.hash)) {
        throw new Error('Invalid stored image reference.')
      }
      hashes.add(source.hash)
      nextCard[sourceKey] = sourceForHash(source.hash)
    }
    return nextCard
  })
  return { project: { ...project, cards }, hashes }
}

function getStoredRecord(value: unknown): StoredProject | undefined {
  if (
    !isRecord(value) ||
    typeof value.savedAt !== 'number' ||
    !Number.isFinite(value.savedAt) ||
    value.savedAt < 0
  ) {
    return undefined
  }
  return { project: value.project, savedAt: value.savedAt }
}

function parseStoredProject(
  project: unknown,
): { project: ProjectFile; hashes: Set<string> } | undefined {
  if (!isRecord(project) || !Array.isArray(project.cards)) return undefined
  try {
    const normalized = replaceProjectSources(project as unknown as ProjectFile, (hash) => `blob:stored-${hash}`)
    const result = parseProject(JSON.stringify(normalized.project))
    if (!result.ok) return undefined
    return { project: result.project, hashes: normalized.hashes }
  } catch {
    return undefined
  }
}

export function createProjectStore(
  storage: ProjectStoreStorage = indexedDbStorage,
  options: ProjectStoreOptions = {},
) {
  const createObjectURL = options.createObjectURL ?? ((blob: Blob) => URL.createObjectURL(blob))
  const revokeObjectURL = options.revokeObjectURL ?? ((url: string) => URL.revokeObjectURL(url))
  const digest = options.digest ?? hashBlob

  return {
    async saveProject(
      project: ProjectFile,
      resolveImage: (src: string) => Promise<Blob>,
    ): Promise<{ savedAt: number }> {
      const images = new Map<string, Blob>()
      const referencedHashes = new Set<string>()
      const resolvedSources = new Map<string, Promise<string>>()
      const storedCards = await Promise.all(project.cards.map(async (card) => {
        const nextCard = { ...card }
        for (const side of ['front', 'back'] as const) {
          const sourceKey = side === 'front' ? 'frontSrc' : 'backSrc'
          const source = nextCard[sourceKey]
          if (!source?.startsWith('blob:') && !source?.startsWith('data:')) continue

          let storedSource = resolvedSources.get(source)
          if (!storedSource) {
            storedSource = (async () => {
              const blob = await resolveImage(source)
              if (!(blob instanceof Blob)) throw new Error('Image source did not resolve to a Blob.')
              const hash = await digest(blob)
              if (!IMAGE_HASH_PATTERN.test(hash)) throw new Error('Image digest was invalid.')
              images.set(hash, blob)
              referencedHashes.add(hash)
              return hash
            })()
            resolvedSources.set(source, storedSource)
          }
          nextCard[sourceKey] = { hash: await storedSource } as unknown as string
        }
        return nextCard
      }))
      const savedAt = Date.now()
      await storage.writeProject(
        { project: { ...project, cards: storedCards }, savedAt },
        images,
        referencedHashes,
      )
      return { savedAt }
    },

    async loadProject(): Promise<{ project: ProjectFile; savedAt: number } | null> {
      const createdUrls: string[] = []
      try {
        const record = getStoredRecord(await storage.readProject())
        if (!record) return null
        const parsed = parseStoredProject(record.project)
        if (!parsed) return null

        const urls = new Map<string, string>()
        for (const hash of parsed.hashes) {
          const image = await storage.readImage(hash)
          if (!(image instanceof Blob)) throw new Error('Stored image is missing.')
          const url = createObjectURL(image)
          createdUrls.push(url)
          urls.set(hash, url)
        }
        const cards = parsed.project.cards.map((card) => {
          const nextCard = { ...card }
          for (const side of ['front', 'back'] as const) {
            const sourceKey = side === 'front' ? 'frontSrc' : 'backSrc'
            const source = nextCard[sourceKey]
            const match = source?.match(/^blob:stored-([a-f0-9]{64})$/)
            if (match) {
              const url = urls.get(match[1])
              if (!url) throw new Error('Stored image reference is invalid.')
              nextCard[sourceKey] = url
            }
          }
          return nextCard
        })
        return { project: { ...parsed.project, cards }, savedAt: record.savedAt }
      } catch {
        for (const url of createdUrls) {
          try {
            revokeObjectURL(url)
          } catch {
            continue
          }
        }
        return null
      }
    },

    async describeSavedProject(): Promise<{ cardCount: number; savedAt: number } | null> {
      try {
        const record = getStoredRecord(await storage.readProject())
        if (!record) return null
        const parsed = parseStoredProject(record.project)
        if (!parsed) return null
        return { cardCount: parsed.project.cards.length, savedAt: record.savedAt }
      } catch {
        return null
      }
    },

    async clearProject(): Promise<void> {
      await storage.clear()
    },
  }
}

const browserProjectStore = createProjectStore()

export const saveProject = browserProjectStore.saveProject
export const loadProject = browserProjectStore.loadProject
export const describeSavedProject = browserProjectStore.describeSavedProject
export const clearProject = browserProjectStore.clearProject

export async function requestPersistence(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
