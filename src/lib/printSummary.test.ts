import { describe, expect, it } from 'vitest'
import { createTranslator } from '../i18n/messages.ts'
import { en } from '../i18n/en.ts'
import { CARD_PRESETS, calculateGrid, calculateTightGrid, PAPER } from './geometry.ts'
import { layoutDuplexPages, layoutPrintAndGlue } from './layout.ts'
import {
  describeLayout,
  previewPages,
  summarizeAllModes,
  summarizePrint,
  type PrintMode,
} from './printSummary.ts'
import type { Card } from '../types.ts'

function makeCard(id: string, quantity = 1, backSrc?: string): Card {
  return {
    id,
    bleedMode: 'IMAGE',
    frontProcessedSrc: `front-${id}`,
    frontCrop: { x: 0, y: 0, width: 750, height: 1050 },
    backProcessedSrc: backSrc,
    backCrop: backSrc ? { x: 0, y: 0, width: 750, height: 1050 } : undefined,
    frontBackground: { enabled: false, color: '#ffffff' },
    backBackground: { enabled: false, color: '#ffffff' },
    bleedColor: '#ffffff',
    quantity,
  }
}

function input(
  presetName: string,
  paperName: 'LETTER' | 'A4',
  mode: PrintMode,
  cards = [makeCard('card-1')],
  pieceOrientation: 'AUTO' | 'UPRIGHT' | 'ROTATED' = 'AUTO',
) {
  return { cards, presetName, paperName, mode, pieceOrientation }
}

describe('summarizePrint', () => {
  it.each([
    ['POKER', 8, 8, 4, 4],
    ['BRIDGE', 8, 9, 6, 6],
    ['MINI', 16, 16, 12, 12],
    ['TAROT', 4, 4, 4, 4],
  ])(
    'uses the real grids for %s on Letter and A4',
    (presetName, letterGlue, a4Glue, letterDuplex, a4Duplex) => {
      expect(
        summarizePrint(input(presetName, 'LETTER', 'ONE_SIDE_GLUE')).cardsPerPage,
      ).toBe(letterGlue)
      expect(
        summarizePrint(input(presetName, 'A4', 'ONE_SIDE_GLUE')).cardsPerPage,
      ).toBe(a4Glue)
      expect(
        summarizePrint(input(presetName, 'LETTER', 'TWO_SIDES_HAND')).cardsPerPage,
      ).toBe(letterDuplex)
      expect(
        summarizePrint(input(presetName, 'A4', 'TWO_SIDES_HAND')).cardsPerPage,
      ).toBe(a4Duplex)
    },
  )

  it('counts PDF pages, sheets, and cards on the final front page', () => {
    const cards = [makeCard('poker', 52)]
    const glue = summarizePrint(input('POKER', 'LETTER', 'ONE_SIDE_GLUE', cards))
    const duplex = summarizePrint(input('POKER', 'LETTER', 'TWO_SIDES_HAND', cards))

    expect(glue).toMatchObject({ cardsPerPage: 8, pages: 7, sheets: 7, lastPageCards: 4 })
    expect(duplex).toMatchObject({
      cardsPerPage: 4,
      pages: 26,
      sheets: 13,
      lastPageCards: 4,
    })
  })

  it('returns zero pages and zero last-page cards for empty decks', () => {
    const result = summarizePrint(input('POKER', 'LETTER', 'ONE_SIDE_GLUE', []))
    expect(result).toMatchObject({ pages: 0, sheets: 0, lastPageCards: 0 })
    expect(result.cardsPerPage).toBeGreaterThan(0)
  })

  it('honors card quantities and the tight-grid orientation override', () => {
    const cards = [makeCard('poker', 5)]
    expect(
      summarizePrint(input('POKER', 'LETTER', 'ONE_SIDE_GLUE', cards)).lastPageCards,
    ).toBe(5)
    expect(
      summarizePrint(input('POKER', 'LETTER', 'ONE_SIDE_GLUE', cards, 'UPRIGHT')),
    ).toMatchObject({ cardsPerPage: 6, rotated: false })
    expect(
      summarizePrint(input('POKER', 'LETTER', 'ONE_SIDE_GLUE', cards, 'ROTATED')),
    ).toMatchObject({ cardsPerPage: 8, rotated: true })
  })

  it('uses the same duplex grid for hand and machine modes', () => {
    const summaries = summarizeAllModes({
      cards: [makeCard('poker', 5)],
      presetName: 'POKER',
      paperName: 'LETTER',
      pieceOrientation: 'ROTATED',
    })
    expect(summaries.TWO_SIDES_MACHINE).toMatchObject({
      cardsPerPage: summaries.TWO_SIDES_HAND.cardsPerPage,
      pages: summaries.TWO_SIDES_HAND.pages,
      sheets: summaries.TWO_SIDES_HAND.sheets,
      lastPageCards: summaries.TWO_SIDES_HAND.lastPageCards,
      columns: summaries.TWO_SIDES_HAND.columns,
      rows: summaries.TWO_SIDES_HAND.rows,
      rotated: summaries.TWO_SIDES_HAND.rotated,
    })
  })
})

describe('previewPages', () => {
  it('uses print-and-glue placement geometry and reports copy ranges', () => {
    const cards = [makeCard('first', 3, 'back-first'), makeCard('second', 2)]
    const grid = calculateTightGrid({
      paper: PAPER.LETTER,
      card: CARD_PRESETS.POKER,
    })
    const actualPages = layoutPrintAndGlue(cards, grid)
    const pages = previewPages(input('POKER', 'LETTER', 'ONE_SIDE_GLUE', cards))

    expect(pages).toHaveLength(actualPages.length)
    expect(pages[0]).toMatchObject({
      pageNumber: 1,
      firstCardNumber: 1,
      lastCardNumber: 5,
    })
    expect(pages[0].placements).toEqual(
      actualPages[0].placements.map((placement) => ({
        cardId: placement.cardId,
        x: placement.x,
        y: placement.y,
        width: placement.width,
        height: placement.height,
        side: placement.side.toUpperCase(),
      })),
    )
  })

  it('returns front and mirrored back pages in PDF order', () => {
    const cards = [makeCard('first', 5, 'back-first')]
    const grid = calculateGrid({ paper: PAPER.LETTER, card: CARD_PRESETS.POKER })
    const pairs = layoutDuplexPages(cards, grid, { offsetX: 0, offsetY: 0 })
    const pages = previewPages(input('POKER', 'LETTER', 'TWO_SIDES_HAND', cards))

    expect(pages).toHaveLength(pairs.length * 2)
    expect(pages.map(({ pageNumber }) => pageNumber)).toEqual([1, 2, 3, 4])
    expect(pages[0]?.placements[0]?.side).toBe('FRONT')
    expect(pages[1]?.placements[0]?.side).toBe('BACK')
    expect(pages[1]?.placements).toEqual(
      pairs[0]?.back.map((placement) => ({
        cardId: placement.cardId,
        x: placement.x,
        y: placement.y,
        width: placement.width,
        height: placement.height,
        side: 'BACK',
      })),
    )
    expect(pages[0]).toMatchObject({ firstCardNumber: 1, lastCardNumber: 4 })
    expect(pages[1]).toMatchObject({ firstCardNumber: 1, lastCardNumber: 4 })
    expect(pages[2]).toMatchObject({ firstCardNumber: 5, lastCardNumber: 5 })
  })

  it('returns no pages for an empty deck', () => {
    expect(previewPages(input('POKER', 'LETTER', 'TWO_SIDES_MACHINE', []))).toEqual([])
  })
})

describe('describeLayout', () => {
  it('uses English messages and locale-aware number formatting', () => {
    const summary = summarizePrint(input('POKER', 'LETTER', 'ONE_SIDE_GLUE'))
    const translate = createTranslator(en, 'en')

    expect(
      describeLayout(summary, {
        locale: 'en',
        paperName: 'LETTER',
        translate,
      }),
    ).toBe('Letter paper. Print and glue. Cards turned to landscape, 2 columns by 4 rows.')
  })
})
