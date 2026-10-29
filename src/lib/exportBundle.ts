import { strToU8, zipSync, type DeflateOptions, type Zippable } from 'fflate'

export type BundleEntry = {
  path: string
  data: Uint8Array | string
  description?: string
}

export const BUNDLE_MIME = 'application/zip'

const STORED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.zip'])
const TEXT_EXTENSIONS = new Set(['.svg', '.dxf', '.plt', '.fcm', '.json', '.txt'])
const ZIP_EPOCH = new Date(1980, 0, 1, 0, 0, 0)

export function validateEntryPath(path: string): string | undefined {
  if (!path) return 'Path must not be empty'
  if (path.length > 200) return 'Path must not exceed 200 characters'
  if (path.startsWith('/')) return 'Path must not start with /'
  if (path.includes('\\')) return 'Path must not contain backslashes'
  if (/^[a-z]:/i.test(path)) return 'Path must not have a drive prefix'
  if (
    path.split('').some((character) => {
      const code = character.charCodeAt(0)
      return code <= 0x1f || (code >= 0x7f && code <= 0x9f)
    })
  ) {
    return 'Path must not contain control characters'
  }
  if (path.endsWith('/')) return 'Path must not end with /'

  const segments = path.split('/')
  if (segments.includes('..')) return 'Path must not contain .. segments'
  if (segments.some((segment) => segment.length > 100)) {
    return 'Path segments must not exceed 100 characters'
  }

  return undefined
}

export function buildReadme(
  entries: { path: string; description?: string }[],
  info?: { appName?: string; generatedOn?: string },
): string {
  const lines = wrapText(info?.appName ?? 'Print Board Game Cards')
  if (info?.generatedOn) lines.push(...wrapText(`Generated on: ${info.generatedOn}`))

  const sortedEntries = [...entries].sort((a, b) => comparePaths(a.path, b.path))
  const describedEntries = sortedEntries.filter((entry) => entry.description)
  const otherEntries = sortedEntries.filter((entry) => !entry.description)

  lines.push('', 'Files:')
  for (const { path, description } of describedEntries) {
    lines.push(...wrapText(`${path}: ${description}`, '- ', '  '))
  }

  if (otherEntries.length > 0) {
    lines.push('', 'Other files:')
    for (const { path } of otherEntries) lines.push(...wrapText(path, '- ', '  '))
  }

  lines.push(
    '',
    'Print reminders:',
    ...wrapText('Print at 100% / "Actual Size" (never "Fit to page").', '- ', '  '),
    ...wrapText('For duplex printing, use "Flip on Long Edge".', '- ', '  '),
    ...wrapText('Registration marks are read from the front page.', '- ', '  '),
  )

  return `${lines.join('\n')}\n`
}

export function buildBundle(
  entries: BundleEntry[],
  options: { readme?: boolean; level?: number } = {},
): Uint8Array {
  const includeReadme = options.readme ?? true
  const overrideLevel = getCompressionLevel(options.level)
  const seenPaths = new Set<string>()

  for (const entry of entries) {
    const error = validateEntryPath(entry.path)
    if (error) throw new RangeError(`${error}: ${entry.path}`)

    const normalizedPath = entry.path.toLowerCase()
    if (seenPaths.has(normalizedPath)) {
      throw new RangeError(`Duplicate path: ${entry.path}`)
    }
    seenPaths.add(normalizedPath)
  }

  if (includeReadme && seenPaths.has('readme.txt')) {
    throw new RangeError('README.txt conflicts with the generated README')
  }

  const orderedEntries = [...entries].sort((a, b) => comparePaths(a.path, b.path))
  const files: Zippable = Object.create(null) as Zippable

  if (includeReadme) {
    files['README.txt'] = [
      strToU8(buildReadme(orderedEntries)),
      { level: overrideLevel ?? 6, mtime: ZIP_EPOCH },
    ]
  }

  for (const entry of orderedEntries) {
    const extension = entry.path.slice(entry.path.lastIndexOf('.')).toLowerCase()
    const level = STORED_EXTENSIONS.has(extension)
      ? 0
      : overrideLevel ?? (TEXT_EXTENSIONS.has(extension) ? 6 : undefined)
    files[entry.path] = [
      typeof entry.data === 'string' ? strToU8(entry.data) : entry.data,
      { level, mtime: ZIP_EPOCH },
    ]
  }

  return zipSync(files)
}

export function suggestedBundleName(deckName: string, paper: 'LETTER' | 'A4'): string {
  const normalizedName = deckName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')

  return `${normalizedName || 'cards'}-${paper.toLowerCase()}.zip`
}

function comparePaths(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function getCompressionLevel(level: number | undefined): DeflateOptions['level'] {
  if (level === undefined) return undefined
  if (!Number.isInteger(level) || level < 0 || level > 9) {
    throw new RangeError('Compression level must be an integer from 0 to 9')
  }
  return level as DeflateOptions['level']
}

function wrapText(text: string, firstPrefix = '', continuationPrefix = firstPrefix): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = firstPrefix
  let hasWord = false

  for (const word of words) {
    let remaining = word
    if (hasWord && line.length + 1 + remaining.length > 72) {
      lines.push(line)
      line = continuationPrefix
      hasWord = false
    }

    while (remaining.length > 0) {
      const available = 72 - line.length
      if (remaining.length <= available) {
        line += `${hasWord ? ' ' : ''}${remaining}`
        hasWord = true
        remaining = ''
      } else {
        const chunk = remaining.slice(0, available)
        line += `${hasWord ? ' ' : ''}${chunk}`
        remaining = remaining.slice(chunk.length)
        lines.push(line)
        line = continuationPrefix
        hasWord = false
      }
    }
  }

  if (hasWord || lines.length === 0) lines.push(line)
  return lines
}
