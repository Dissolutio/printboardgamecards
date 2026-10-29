import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { DOMParser } from '@xmldom/xmldom'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  fitBoundsToSafeArea,
  orderedCardIds,
  transformBounds,
} from './build-classic-deck.mjs'

const deckDirectory = join(process.cwd(), 'public/decks/classic')
const forbidden = /<(?:text|tspan|filter|image|style)\b|font-family|class=|\b(?:NaN|undefined)\b/i
const safeArea = 9

describe('classic deck assets', () => {
  let manifest: {
    viewBox: { width: number; height: number }
    cards: { id: string; rank: string; suit: string | null; file: string }[]
  }

  beforeAll(async () => {
    manifest = JSON.parse(await readFile(join(deckDirectory, 'manifest.json'), 'utf8'))
  })

  it('orders ranks and suits consistently with jokers last', () => {
    expect(orderedCardIds()).toEqual([
      ...['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'].flatMap(
        (rank) => ['S', 'H', 'D', 'C'].map((suit) => `${rank}${suit}`),
      ),
      'Joker1',
      'Joker2',
    ])
  })

  it('contains exactly 54 manifest cards and no stray files', async () => {
    expect(manifest.cards).toHaveLength(54)
    expect(manifest.cards.map(({ id }) => id)).toEqual(orderedCardIds())
    expect(new Set(manifest.cards.map(({ id }) => id)).size).toBe(54)
    expect(manifest.cards.slice(-2)).toEqual([
      { id: 'Joker1', rank: 'Joker', suit: null, file: 'Joker1.svg' },
      { id: 'Joker2', rank: 'Joker', suit: null, file: 'Joker2.svg' },
    ])

    const expectedFiles = new Set([
      ...manifest.cards.map(({ file }) => file),
      'manifest.json',
      'LICENSE.txt',
    ])
    expect(new Set(await readdir(deckDirectory))).toEqual(expectedFiles)
    for (const { file } of manifest.cards) {
      expect((await stat(join(deckDirectory, file))).isFile()).toBe(true)
    }
  })

  it('has cleaned, valid SVGs with local references and the manifest viewBox', async () => {
    for (const { file } of manifest.cards) {
      const svg = await readFile(join(deckDirectory, file), 'utf8')
      const errors: string[] = []
      const document = new DOMParser({
        onError: (_level, message) => errors.push(message),
      }).parseFromString(svg, 'image/svg+xml')
      const root = document.documentElement

      expect(errors, file).toEqual([])
      expect(root.localName, file).toBe('svg')
      expect(root.getAttribute('viewBox'), file).toBe(
        `0 0 ${manifest.viewBox.width} ${manifest.viewBox.height}`,
      )
      expect(root.getAttribute('width'), file).toBe(String(manifest.viewBox.width))
      expect(root.getAttribute('height'), file).toBe(String(manifest.viewBox.height))
      expect(svg, file).not.toMatch(forbidden)

      for (const element of Array.from(root.getElementsByTagName('*'))) {
        for (const attribute of Array.from(element.attributes)) {
          if (attribute.name === 'href' || attribute.name === 'xlink:href') {
            expect(attribute.value, `${file}: ${attribute.name}`).toMatch(/^#/)
          }
        }
      }
    }
  })

  it('keeps both outlined Joker wordmarks inside the 9 pt safe area', async () => {
    for (const id of ['Joker1', 'Joker2']) {
      const svg = await readFile(join(deckDirectory, `${id}.svg`), 'utf8')
      const document = new DOMParser().parseFromString(svg, 'image/svg+xml')
      const root = document.documentElement
      const bounds = root
        .getAttribute('data-joker-wordmark-bounds')
        ?.split(/\s+/)
        .map(Number)
      expect(svg, id).not.toMatch(/<(?:text|tspan)\b|font-family/i)
      expect(bounds, id).toHaveLength(4)
      expect(bounds?.[0], id).toBeGreaterThanOrEqual(safeArea)
      expect(bounds?.[1], id).toBeGreaterThanOrEqual(safeArea)
      expect(bounds?.[2], id).toBeLessThanOrEqual(manifest.viewBox.width - safeArea)
      expect(bounds?.[3], id).toBeLessThanOrEqual(manifest.viewBox.height - safeArea)

      const wordmarks = Array.from(root.getElementsByTagName('*')).filter((element) =>
        element.hasAttribute('data-joker-wordmark'),
      )
      expect(
        new Set(wordmarks.map((element) => element.getAttribute('data-joker-wordmark'))),
        id,
      ).toEqual(new Set(['top-left', 'bottom-right']))
    }
  })

  it('uniformly scales and centers bounds inside the safe area', () => {
    const bounds = { minX: 2, minY: 4, maxX: 178, maxY: 240 }
    const viewBox = { width: 167.0869141, height: 242.6669922 }
    const layout = fitBoundsToSafeArea(bounds, viewBox, safeArea)
    const fitted = transformBounds(bounds, layout)

    expect(layout.scale).toBeLessThan(1)
    expect(fitted.minX).toBeGreaterThanOrEqual(safeArea)
    expect(fitted.minY).toBeGreaterThanOrEqual(safeArea)
    expect(fitted.maxX).toBeLessThanOrEqual(viewBox.width - safeArea)
    expect(fitted.maxY).toBeLessThanOrEqual(viewBox.height - safeArea)
  })

  it('keeps the complete deck below the 1.5 MiB optimized SVG budget', async () => {
    const totalBytes = (
      await Promise.all(manifest.cards.map(({ file }) => stat(join(deckDirectory, file))))
    ).reduce((total, file) => total + file.size, 0)
    expect(totalBytes).toBeLessThan(1.5 * 1024 * 1024)
  })
})
