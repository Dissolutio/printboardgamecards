import { describe, expect, it } from 'vitest'
import {
  CARD_PRESETS,
  calculateGrid,
  calculateTightGrid,
  DEFAULT_BLEED,
  mmToPt,
  PAPER,
} from './geometry.ts'
import {
  layoutDuplexPages,
  layoutPages,
  layoutPrintAndGlue,
} from './layout.ts'
import type { Card } from '../types.ts'

function makeCard(
  id: string,
  quantity: number,
  frontSrc?: string,
  backSrc?: string,
): Card {
  return {
    id,
    bleedMode: 'IMAGE',
    frontProcessedSrc: frontSrc,
    backProcessedSrc: backSrc,
    frontCrop: frontSrc ? { x: 0, y: 0, width: 750, height: 1050 } : undefined,
    backCrop: backSrc ? { x: 0, y: 0, width: 750, height: 1050 } : undefined,
    frontBackground: { enabled: true, color: '#f5efe6' },
    backBackground: { enabled: false, color: '#ffffff' },
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

describe('layoutDuplexPages', () => {
  const grid = calculateGrid({
    paper: PAPER.LETTER,
    card: CARD_PRESETS.POKER,
    bleed: DEFAULT_BLEED,
  })

  describe('layoutPrintAndGlue', () => {
    const grid = calculateTightGrid({
      paper: PAPER.LETTER,
      card: CARD_PRESETS.POKER,
    })

    it('prints all fronts before backs and flows continuously across pages', () => {
      const pages = layoutPrintAndGlue(
        Array.from({ length: 4 }, (_, index) =>
          makeCard(
            `card-${index + 1}`,
            1,
            `front-${index + 1}`,
            `back-${index + 1}`,
          ),
        ),
        grid,
      )
      const pieces = pages.flatMap((page) => page.placements)

      expect(pages).toHaveLength(2)
      expect(pages.map((page) => page.placements.length)).toEqual([6, 2])
      expect(pieces.map((placement) => placement.side)).toEqual([
        'front',
        'front',
        'front',
        'front',
        'back',
        'back',
        'back',
        'back',
      ])
      expect(pieces.map((placement) => placement.cardId)).toEqual([
        'card-1',
        'card-2',
        'card-3',
        'card-4',
        'card-1',
        'card-2',
        'card-3',
        'card-4',
      ])
      expect(grid.gap).toBeCloseTo(mmToPt(5))

      const [firstFront, secondFront] = pages[0].placements
      const firstTrimRight = firstFront.x + firstFront.paintedBleed + CARD_PRESETS.POKER.width
      const secondTrimLeft = secondFront.x + secondFront.paintedBleed
      expect(secondTrimLeft - firstTrimRight).toBeCloseTo(mmToPt(5))
    })

    it('keeps painted rectangles inside the page margins and non-overlapping', () => {
      const cards = [
        { ...makeCard('image-a', 1, 'front-a', 'back-a'), bleedMode: 'IMAGE' as const },
        { ...makeCard('color-a', 1, 'front-b', 'back-b'), bleedMode: 'COLOR' as const },
        { ...makeCard('image-b', 1, 'front-c', 'back-c'), bleedMode: 'IMAGE' as const },
        { ...makeCard('color-b', 1, 'front-d', 'back-d'), bleedMode: 'COLOR' as const },
      ]
      const pages = layoutPrintAndGlue(cards, grid)
      const margin = mmToPt(5)

      for (const page of pages) {
        for (let first = 0; first < page.placements.length; first += 1) {
          const a = page.placements[first]
          expect(a.x).toBeGreaterThanOrEqual(margin - 1e-8)
          expect(a.y).toBeGreaterThanOrEqual(margin - 1e-8)
          expect(a.x + a.width).toBeLessThanOrEqual(PAPER.LETTER.width - margin + 1e-8)
          expect(a.y + a.height).toBeLessThanOrEqual(PAPER.LETTER.height - margin + 1e-8)

          for (let second = first + 1; second < page.placements.length; second += 1) {
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

    it('skips a card without a front and omits a back without art or background', () => {
      const noFront = makeCard('no-front', 1, undefined, 'back-art')
      const noBack = makeCard('no-back', 1, 'front-art')
      const pages = layoutPrintAndGlue([noFront, noBack], grid)

      expect(pages).toHaveLength(1)
      expect(pages[0].placements.map(({ cardId, side }) => [cardId, side])).toEqual([
        ['no-back', 'front'],
      ])
    })

    it('includes a solid-color back without a back image', () => {
      const card = {
        ...makeCard('solid-back', 1, 'front-art'),
        backBackground: { enabled: true, color: '#0000ff' },
      }
      const pages = layoutPrintAndGlue([card], grid)

      expect(pages.flatMap((page) => page.placements.map(({ side }) => side))).toEqual([
        'front',
        'back',
      ])
    })

    it('omits a disabled color-only back and includes it when enabled', () => {
      const card = {
        ...makeCard('remembered-back', 1, 'front-art'),
        backBackground: { enabled: false, color: '#0000ff' },
      }
      const disabledPages = layoutPrintAndGlue([card], grid)
      const enabledPages = layoutPrintAndGlue(
        [{ ...card, backBackground: { ...card.backBackground, enabled: true } }],
        grid,
      )

      expect(disabledPages.flatMap((page) => page.placements.map(({ side }) => side))).toEqual([
        'front',
      ])
      expect(enabledPages.flatMap((page) => page.placements.map(({ side }) => side))).toEqual([
        'front',
        'back',
      ])
    })
  })
  const noCalibration = { offsetX: 0, offsetY: 0 }

  it('places five Poker cards into two aligned front/back pairs', () => {
    const pairs = layoutDuplexPages(
      [makeCard('poker-a', 3, 'front-a'), makeCard('poker-b', 2, 'front-b')],
      grid,
      noCalibration,
    )

    expect(pairs).toHaveLength(2)
    expect(pairs.map(({ front }) => front.length)).toEqual([4, 1])
    expect(pairs.map(({ back }) => back.length)).toEqual([4, 1])
    expect(pairs[1].front[0].col).toBe(0)
    expect(pairs[1].back[0].col).toBe(1)
  })

  it('keeps each back placement in the front placement row and mirrors by column', () => {
    const [{ front, back }] = layoutDuplexPages(
      [makeCard('poker-a', 4, 'front-a')],
      grid,
      noCalibration,
    )

    expect(back.map((placement) => placement.col)).toEqual([1, 0, 1, 0])
    expect(back.map((placement) => placement.row)).toEqual(
      front.map((placement) => placement.row),
    )
  })

  it('applies a 1 mm horizontal offset only to the back', () => {
    const card = [makeCard('poker-a', 1, 'front-a')]
    const frontBackPair = layoutDuplexPages(card, grid, noCalibration)[0]
    const shiftedPair = layoutDuplexPages(card, grid, {
      offsetX: mmToPt(1),
      offsetY: 0,
    })[0]

    expect(shiftedPair.front[0]).toEqual(frontBackPair.front[0])
    expect(shiftedPair.back[0].x - frontBackPair.back[0].x).toBeCloseTo(-2.83, 2)
  })

  it('keeps a back placement when the card has no back image', () => {
    const [pair] = layoutDuplexPages(
      [makeCard('poker-a', 1, 'front-a')],
      grid,
      noCalibration,
    )

    expect(pair.front).toHaveLength(1)
    expect(pair.back).toHaveLength(1)
  })
})
