import { describe, expect, it } from 'vitest'
import { CARD_PRESETS, calculateGrid, DEFAULT_BLEED, PAPER } from './geometry.ts'
import { trimRects } from './cutRects.ts'

describe('trimRects', () => {
  const cardSize = CARD_PRESETS.POKER
  const grid = calculateGrid({ paper: PAPER.LETTER, card: cardSize })

  it('places rectangles row by row using the front trim positions', () => {
    const rects = trimRects({ grid, cardSize, count: 3 })

    expect(rects).toEqual([
      {
        x: grid.originX + DEFAULT_BLEED,
        y: grid.originY + DEFAULT_BLEED,
        width: cardSize.width,
        height: cardSize.height,
      },
      {
        x: grid.originX + grid.cellW + DEFAULT_BLEED,
        y: grid.originY + DEFAULT_BLEED,
        width: cardSize.width,
        height: cardSize.height,
      },
      {
        x: grid.originX + DEFAULT_BLEED,
        y: grid.originY + grid.cellH + DEFAULT_BLEED,
        width: cardSize.width,
        height: cardSize.height,
      },
    ])
  })

  it('clamps the count between zero and the grid capacity', () => {
    expect(trimRects({ grid, cardSize, count: -2 })).toHaveLength(0)
    expect(trimRects({ grid, cardSize, count: grid.cols * grid.rows + 2 })).toHaveLength(
      grid.cols * grid.rows,
    )
  })
})
