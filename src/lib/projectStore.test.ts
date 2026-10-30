import { describe, expect, it, vi } from 'vitest'
import {
  createProjectStore,
  type ProjectStoreStorage,
} from './projectStore.ts'
import type { ProjectFile, ProjectSettings } from './project.ts'

const settings: ProjectSettings = {
  presetName: 'POKER',
  paperName: 'LETTER',
  exportMode: 'PRINT_GLUE',
  pieceOrientation: 'AUTO',
}

function createProject(sources: Array<[string?, string?]>): ProjectFile {
  return {
    version: 1,
    settings,
    cards: sources.map(([frontSrc, backSrc], index) => ({
      id: `card-${index}`,
      bleedMode: 'IMAGE',
      ...(frontSrc !== undefined && { frontSrc }),
      ...(backSrc !== undefined && { backSrc }),
      frontBackground: { enabled: false, color: '#ffffff' },
      backBackground: { enabled: false, color: '#ffffff' },
      bleedColor: '#ffffff',
      quantity: 1,
    })),
  }
}

function createMemoryStorage(): ProjectStoreStorage & {
  images: Map<string, Blob>
  project: unknown
} {
  let project: unknown
  const images = new Map<string, Blob>()
  return {
    get project() {
      return project
    },
    set project(value: unknown) {
      project = value
    },
    images,
    async readProject() {
      return project
    },
    async readImage(hash) {
      return images.get(hash)
    },
    async writeProject(value, newImages, referencedHashes) {
      project = value
      for (const [hash, blob] of newImages) images.set(hash, blob)
      for (const hash of images.keys()) {
        if (!referencedHashes.has(hash)) images.delete(hash)
      }
    },
    async clear() {
      project = undefined
      images.clear()
    },
  }
}

function createTestStore(storage = createMemoryStorage()) {
  let nextUrl = 0
  return {
    storage,
    store: createProjectStore(storage, {
      digest: async (blob) => (await blob.text()) === 'shared' ? 'a'.repeat(64) : 'b'.repeat(64),
      createObjectURL: () => `blob:restored-${++nextUrl}`,
      revokeObjectURL: vi.fn(),
    }),
  }
}

describe('project store', () => {
  it('stores one blob for cards that share an image', async () => {
    const { storage, store } = createTestStore()
    const project = createProject([
      ['blob:first', undefined],
      ['data:image/png;base64,shared', undefined],
    ])
    const resolveImage = vi.fn(async () => new Blob(['shared']))

    await store.saveProject(project, resolveImage)

    expect(storage.images.size).toBe(1)
    expect(resolveImage).toHaveBeenCalledTimes(2)
    expect(storage.project).toMatchObject({
      project: {
        cards: [
          { frontSrc: { hash: 'a'.repeat(64) } },
          { frontSrc: { hash: 'a'.repeat(64) } },
        ],
      },
    })
  })

  it('uses the SHA-256 hash of image bytes as the image key', async () => {
    const storage = createMemoryStorage()
    const store = createProjectStore(storage)

    await store.saveProject(createProject([['blob:front']]), async () => new Blob(['shared']))

    expect([...storage.images.keys()]).toEqual([
      'a4d26868017c0ccffe2efe50944ef4211834660cca834c6e9f86dec6a88246fa',
    ])
  })

  it('round trips image references and leaves static sources unchanged', async () => {
    const { store } = createTestStore()
    const project = createProject([
      ['blob:front', 'https://example.test/back.png'],
      ['/app/decks/classic/AS.svg', undefined],
    ])

    await store.saveProject(project, async () => new Blob(['shared']))
    const loaded = await store.loadProject()

    expect(loaded?.project.cards[0].frontSrc).toBe('blob:restored-1')
    expect(loaded?.project.cards[0].backSrc).toBe('https://example.test/back.png')
    expect(loaded?.project.cards[1].frontSrc).toBe('/app/decks/classic/AS.svg')
    expect(loaded?.savedAt).toEqual(expect.any(Number))
  })

  it('returns null for corrupt project data', async () => {
    const storage = createMemoryStorage()
    storage.project = { project: { version: 4, cards: [] }, savedAt: 123 }
    const { store } = createTestStore(storage)

    await expect(store.loadProject()).resolves.toBeNull()
    await expect(store.describeSavedProject()).resolves.toBeNull()
  })

  it('removes images that are no longer referenced', async () => {
    const { storage, store } = createTestStore()
    await store.saveProject(createProject([['blob:old']]), async () => new Blob(['old']))

    await store.saveProject(createProject([['https://example.test/image.png']]), async () => {
      throw new Error('Static images must not be resolved.')
    })

    expect(storage.images.size).toBe(0)
  })

  it('does not load image blobs when describing a saved project', async () => {
    const storage = createMemoryStorage()
    const { store } = createTestStore(storage)
    await store.saveProject(createProject([['blob:front']]), async () => new Blob(['shared']))
    const readImage = vi.spyOn(storage, 'readImage')

    await expect(store.describeSavedProject()).resolves.toEqual({
      cardCount: 1,
      savedAt: expect.any(Number),
    })
    expect(readImage).not.toHaveBeenCalled()
  })

  it('clears both the project and its images', async () => {
    const { storage, store } = createTestStore()
    await store.saveProject(createProject([['blob:front']]), async () => new Blob(['shared']))

    await store.clearProject()

    expect(storage.project).toBeUndefined()
    expect(storage.images.size).toBe(0)
  })
})
