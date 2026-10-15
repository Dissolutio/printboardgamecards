import type { Card } from '../types.ts'
import { applyCalibration, type calculateGrid } from './geometry.ts'

export type Grid = ReturnType<typeof calculateGrid>
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
