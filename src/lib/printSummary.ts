import type { MessageParams } from '../i18n/messages.ts'
import { formatNumber } from '../i18n/numbers.ts'
import type { Card } from '../types.ts'
import {
  CARD_PRESETS,
  calculateGrid,
  calculateTightGrid,
  PAPER,
  type PieceOrientation,
} from './geometry.ts'
import {
  layoutDuplexPages,
  layoutPrintAndGlue,
  type Placement,
} from './layout.ts'

export type PrintMode = 'ONE_SIDE_GLUE' | 'TWO_SIDES_HAND' | 'TWO_SIDES_MACHINE'

export type ModeSummary = {
  mode: PrintMode
  cardsPerPage: number
  pages: number
  sheets: number
  lastPageCards: number
  columns: number
  rows: number
  rotated: boolean
}

type SummaryInput = {
  cards: Card[]
  presetName: string
  paperName: keyof typeof PAPER
  pieceOrientation: PieceOrientation
}

type PrintInput = SummaryInput & { mode: PrintMode }

export type PreviewPlacement = {
  cardId: string
  x: number
  y: number
  width: number
  height: number
  side: 'FRONT' | 'BACK'
}

export type PreviewPage = {
  pageNumber: number
  placements: PreviewPlacement[]
  firstCardNumber: number
  lastCardNumber: number
}

export type LayoutDescriptionStrings = {
  locale: string
  paperName: keyof typeof PAPER
  translate: (key: string, params?: MessageParams) => string
}

const modeMessageKeys: Record<PrintMode, string> = {
  ONE_SIDE_GLUE: 'printSummary.mode.ONE_SIDE_GLUE',
  TWO_SIDES_HAND: 'printSummary.mode.TWO_SIDES_HAND',
  TWO_SIDES_MACHINE: 'printSummary.mode.TWO_SIDES_MACHINE',
}

function getCardSize(presetName: string) {
  const cardSize = CARD_PRESETS[presetName as keyof typeof CARD_PRESETS]
  if (!cardSize) throw new RangeError(`Unknown card preset: ${presetName}`)
  return cardSize
}

function makeCardNumbersById(placements: Placement[]): Map<string, number[]> {
  const numbersById = new Map<string, number[]>()
  placements.forEach(({ cardId }, index) => {
    const numbers = numbersById.get(cardId) ?? []
    numbers.push(index + 1)
    numbersById.set(cardId, numbers)
  })
  return numbersById
}

function makePreviewPage(
  pageNumber: number,
  placements: Array<Placement & { side?: 'front' | 'back' }>,
  numbersById: Map<string, number[]>,
  occurrencesBySide: Record<'FRONT' | 'BACK', Map<string, number>>,
  defaultSide: 'FRONT' | 'BACK' = 'FRONT',
): PreviewPage {
  const cardNumbers: number[] = []
  const previewPlacements = placements.map((placement) => {
    const side = placement.side === 'back' ? 'BACK' : defaultSide
    const occurrences = occurrencesBySide[side]
    const occurrence = occurrences.get(placement.cardId) ?? 0
    const cardNumber = numbersById.get(placement.cardId)?.[occurrence]
    occurrences.set(placement.cardId, occurrence + 1)
    if (cardNumber !== undefined) cardNumbers.push(cardNumber)

    return {
      cardId: placement.cardId,
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
      side,
    }
  })

  return {
    pageNumber,
    placements: previewPlacements,
    firstCardNumber: cardNumbers.length > 0 ? Math.min(...cardNumbers) : 0,
    lastCardNumber: cardNumbers.length > 0 ? Math.max(...cardNumbers) : 0,
  }
}

function makeOccurrencesBySide(): Record<'FRONT' | 'BACK', Map<string, number>> {
  return { FRONT: new Map(), BACK: new Map() }
}

export function summarizePrint(input: PrintInput): ModeSummary {
  const paper = PAPER[input.paperName]
  const card = getCardSize(input.presetName)

  if (input.mode === 'ONE_SIDE_GLUE') {
    const grid = calculateTightGrid({
      paper,
      card,
      orientation: input.pieceOrientation,
    })
    const pages = layoutPrintAndGlue(input.cards, grid)
    const lastFrontPage = pages.findLast((page) =>
      page.placements.some(({ side }) => side === 'front'),
    )

    return {
      mode: input.mode,
      cardsPerPage: grid.cols * grid.rows,
      pages: pages.length,
      sheets: pages.length,
      lastPageCards:
        lastFrontPage?.placements.filter(({ side }) => side === 'front').length ?? 0,
      columns: grid.cols,
      rows: grid.rows,
      rotated: grid.orientation === 'ROTATED',
    }
  }

  const grid = calculateGrid({ paper, card })
  const pagePairs = layoutDuplexPages(input.cards, grid, { offsetX: 0, offsetY: 0 })

  return {
    mode: input.mode,
    cardsPerPage: grid.cols * grid.rows,
    pages: pagePairs.length * 2,
    sheets: pagePairs.length,
    lastPageCards: pagePairs.at(-1)?.front.length ?? 0,
    columns: grid.cols,
    rows: grid.rows,
    rotated: false,
  }
}

export function summarizeAllModes(
  input: SummaryInput,
): Record<PrintMode, ModeSummary> {
  return {
    ONE_SIDE_GLUE: summarizePrint({ ...input, mode: 'ONE_SIDE_GLUE' }),
    TWO_SIDES_HAND: summarizePrint({ ...input, mode: 'TWO_SIDES_HAND' }),
    TWO_SIDES_MACHINE: summarizePrint({ ...input, mode: 'TWO_SIDES_MACHINE' }),
  }
}

export function previewPages(input: PrintInput): PreviewPage[] {
  const paper = PAPER[input.paperName]
  const card = getCardSize(input.presetName)
  const occurrencesBySide = makeOccurrencesBySide()

  if (input.mode === 'ONE_SIDE_GLUE') {
    const grid = calculateTightGrid({
      paper,
      card,
      orientation: input.pieceOrientation,
    })
    const pages = layoutPrintAndGlue(input.cards, grid)
    const frontPlacements = pages.flatMap((page) =>
      page.placements.filter(({ side }) => side === 'front'),
    )
    const numbersById = makeCardNumbersById(frontPlacements)

    return pages.map((page, index) =>
      makePreviewPage(index + 1, page.placements, numbersById, occurrencesBySide),
    )
  }

  const grid = calculateGrid({ paper, card })
  const pagePairs = layoutDuplexPages(input.cards, grid, { offsetX: 0, offsetY: 0 })
  const numbersById = makeCardNumbersById(pagePairs.flatMap(({ front }) => front))

  return pagePairs.flatMap(({ front, back }, index) => [
    makePreviewPage(index * 2 + 1, front, numbersById, occurrencesBySide),
    makePreviewPage(index * 2 + 2, back, numbersById, occurrencesBySide, 'BACK'),
  ])
}

export function describeLayout(
  summary: ModeSummary,
  strings: LayoutDescriptionStrings,
): string {
  const paper = strings.translate(`printSummary.paper.${strings.paperName}`)
  const mode = strings.translate(modeMessageKeys[summary.mode])
  const columns = formatNumber(summary.columns, strings.locale)
  const rows = formatNumber(summary.rows, strings.locale)
  const orientationKey = summary.rotated
    ? 'printSummary.layout.landscape'
    : 'printSummary.layout.portrait'

  return strings.translate(orientationKey, { paper, mode, columns, rows })
}
