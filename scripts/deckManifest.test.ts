import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseDeckManifest } from '../src/lib/deckManifest.ts'

const manifestFile = new URL('../public/decks/classic/manifest.json', import.meta.url)

type TestManifest = {
  cards: Array<Record<string, unknown>>
  viewBox: Record<string, unknown>
}

function readRealManifest(): unknown {
  return JSON.parse(readFileSync(manifestFile, 'utf8'))
}

describe('parseDeckManifest', () => {
  it('parses the real classic deck manifest', () => {
    const result = parseDeckManifest(readRealManifest())

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.manifest.cards).toHaveLength(54)
  })

  it.each([
    ['duplicate card ids', (manifest: TestManifest) => {
      manifest.cards[1].id = manifest.cards[0].id
    }],
    ['a path separator', (manifest: TestManifest) => {
      manifest.cards[0].file = 'cards/AS.svg'
    }],
    ['parent traversal', (manifest: TestManifest) => {
      manifest.cards[0].file = 'A..S.svg'
    }],
    ['the wrong extension', (manifest: TestManifest) => {
      manifest.cards[0].file = 'AS.png'
    }],
    ['an invalid viewBox', (manifest: TestManifest) => {
      manifest.viewBox.width = Infinity
    }],
    ['an invalid suit', (manifest: TestManifest) => {
      manifest.cards[0].suit = 'X'
    }],
  ])('rejects %s', (_description, mutate) => {
    const manifest = readRealManifest() as TestManifest
    mutate(manifest)

    const result = parseDeckManifest(manifest)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).not.toBe('')
  })

  it('rejects non-object input without throwing', () => {
    expect(parseDeckManifest(null).ok).toBe(false)
    expect(parseDeckManifest([]).ok).toBe(false)
    expect(parseDeckManifest('manifest').ok).toBe(false)
  })
})
