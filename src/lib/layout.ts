import type { Card } from '../types.ts'
import type { calculateGrid } from './geometry.ts'

export type Grid = ReturnType<typeof calculateGrid>

export type Placement = {
  cardId: string
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
    card.frontSrc && card.frontCrop
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
