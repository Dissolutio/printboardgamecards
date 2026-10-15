import type { Card } from '../types.ts'
import {
  applyCalibration,
  DEFAULT_BLEED,
  type calculateGrid,
  type calculateTightGrid,
} from './geometry.ts'
import type { CardSide } from '../types.ts'
import { hasBackground } from './piece.ts'

export type Grid = ReturnType<typeof calculateGrid>
export type TightGrid = ReturnType<typeof calculateTightGrid>
export type Calibration = { offsetX: number; offsetY: number }

export type Placement = {
  cardId: string
  row: number
  col: number
  x: number
  y: number
  width: number
  height: number
}

export type Page = {
  placements: Placement[]
}

export function layoutPages(cards: Card[], grid: Grid): Page[] {
  const printableCards = cards.flatMap((card) =>
    card.frontProcessedSrc && card.frontCrop
      ? Array.from({ length: card.quantity }, () => card)
      : [],
  )
  const pageCapacity = grid.cols * grid.rows

  if (printableCards.length > 0 && pageCapacity <= 0) {
    throw new RangeError('The grid must contain at least one cell.')
  }

  const pages: Page[] = []

  for (let start = 0; start < printableCards.length; start += pageCapacity) {
    const pageCards = printableCards.slice(start, start + pageCapacity)
    pages.push({
      placements: pageCards.map((card, index) => {
        const col = index % grid.cols
        const row = Math.floor(index / grid.cols)

        return {
          cardId: card.id,
          row,
          col,
          x: grid.originX + col * grid.cellW,
          y: grid.originY + row * grid.cellH,
          width: grid.cellW,
          height: grid.cellH,
        }
      }),
    })
  }

  return pages
}

export type DuplexPage = {
  front: Placement[]
  back: Placement[]
}

export type PrintAndGluePlacement = Placement & {
  side: CardSide
  paintedBleed: number
}

export type PrintAndGluePage = {
  placements: PrintAndGluePlacement[]
}

export function layoutPrintAndGlue(cards: Card[], grid: TightGrid): PrintAndGluePage[] {
  const printableCards = cards.filter(
    (card) => card.frontProcessedSrc && card.frontCrop,
  )
  const fronts = printableCards.flatMap((card) =>
    Array.from({ length: card.quantity }, () => ({ card, side: 'front' as const })),
  )
  const backs = printableCards.flatMap((card) =>
    (card.backProcessedSrc && card.backCrop) || hasBackground(card, 'back')
      ? Array.from({ length: card.quantity }, () => ({ card, side: 'back' as const }))
      : [],
  )
  const pieces = [...fronts, ...backs]
  const pageCapacity = grid.cols * grid.rows

  if (pieces.length > 0 && pageCapacity <= 0) {
    throw new RangeError('The grid must contain at least one cell.')
  }

  const trimWidth = grid.cellW - grid.gap
  const trimHeight = grid.cellH - grid.gap
  const paintedBleed = Math.min(DEFAULT_BLEED, grid.gap / 2)
  const pages: PrintAndGluePage[] = []

  for (let start = 0; start < pieces.length; start += pageCapacity) {
    const pagePieces = pieces.slice(start, start + pageCapacity)
    pages.push({
      placements: pagePieces.map(({ card, side }, index) => {
        const col = index % grid.cols
        const row = Math.floor(index / grid.cols)
        const trimX = grid.originX + col * grid.cellW
        const trimY = grid.originY + row * grid.cellH

        return {
          cardId: card.id,
          side,
          row,
          col,
          x: trimX - paintedBleed,
          y: trimY - paintedBleed,
          width: trimWidth + 2 * paintedBleed,
          height: trimHeight + 2 * paintedBleed,
          paintedBleed,
        }
      }),
    })
  }

  return pages
}

export function layoutDuplexPages(
  cards: Card[],
  grid: Grid,
  calibration: Calibration,
): DuplexPage[] {
  return layoutPages(cards, grid).map(({ placements: front }) => {
    const back = front.map((placement) => {
      const col = grid.cols - 1 - placement.col
      const backOrigin = applyCalibration(
        {
          x: grid.originX + col * grid.cellW,
          y: grid.originY + placement.row * grid.cellH,
        },
        calibration,
      ).back

      return {
        ...placement,
        col,
        x: backOrigin.x,
        y: backOrigin.y,
      }
    })

    return { front, back }
  })
}
