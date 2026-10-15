import { describe, expect, it } from 'vitest'
import { CARD_PRESETS, calculateGrid, DEFAULT_BLEED, PAPER } from './geometry.ts'
import { layoutPages } from './layout.ts'
import type { Card } from '../types.ts'

function makeCard(id: string, quantity: number, frontSrc?: string): Card {
  return {
    id,
    ...CARD_PRESETS.POKER,
    frontSrc,
    frontCrop: frontSrc ? { x: 0, y: 0, width: 750, height: 1050 } : undefined,
    bleedMode: 'IMAGE',
    bleedColor: '#ffffff',
    quantity,
  }
}

describe('layoutPages', () => {
  const grid = calculateGrid({
    paper: PAPER.LETTER,
    card: CARD_PRESETS.POKER,
    bleed: DEFAULT_BLEED,
  })

  it('expands quantities into pages of four and one placements', () => {
    const pages = layoutPages(
      [makeCard('poker-a', 3, 'data:image/png;base64,front-a'), makeCard('poker-b', 2, 'data:image/png;base64,front-b')],
      grid,
    )

    expect(grid.cols).toBe(2)
    expect(grid.rows).toBe(2)
    expect(pages).toHaveLength(2)
    expect(pages.map((page) => page.placements.length)).toEqual([4, 1])
  })

  it('places every card inside the Letter page margins', () => {
    const pages = layoutPages([makeCard('poker-a', 5, 'data:image/png;base64,front')], grid)

    for (const page of pages) {
      for (const placement of page.placements) {
        expect(placement.x).toBeGreaterThanOrEqual(18)
        expect(placement.y).toBeGreaterThanOrEqual(18)
        expect(placement.x + placement.width).toBeLessThanOrEqual(PAPER.LETTER.width - 18)
        expect(placement.y + placement.height).toBeLessThanOrEqual(PAPER.LETTER.height - 18)
      }
    }
  })

  it('does not overlap placements on a page', () => {
    const pages = layoutPages([makeCard('poker-a', 5, 'data:image/png;base64,front')], grid)

    for (const page of pages) {
      for (let first = 0; first < page.placements.length; first += 1) {
        for (let second = first + 1; second < page.placements.length; second += 1) {
          const a = page.placements[first]
          const b = page.placements[second]
          const separated =
            a.x + a.width <= b.x ||
            b.x + b.width <= a.x ||
            a.y + a.height <= b.y ||
            b.y + b.height <= a.y

          expect(separated).toBe(true)
        }
      }
    }
  })

  it('skips cards without a cropped front image', () => {
    expect(layoutPages([makeCard('uncropped', 3)], grid)).toEqual([])
  })
})
