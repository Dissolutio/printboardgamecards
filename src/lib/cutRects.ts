import type { Size } from './geometry.ts'
import { DEFAULT_BLEED } from './geometry.ts'
import type { Grid } from './layout.ts'

export type TrimRect = {
  x: number
  y: number
  width: number
  height: number
}

export type CutRectsInput = {
  grid: Grid
  cardSize: Size
  count: number
}

export function trimRects({ grid, cardSize, count }: CutRectsInput): TrimRect[] {
  const capacity =
    Math.max(0, Math.floor(grid.cols)) * Math.max(0, Math.floor(grid.rows))
  const cardCount = !Number.isNaN(count)
    ? Math.min(capacity, Math.max(0, Math.floor(count)))
    : 0

  return Array.from({ length: cardCount }, (_, index) => {
    const col = index % grid.cols
    const row = Math.floor(index / grid.cols)

    return {
      x: grid.originX + col * grid.cellW + DEFAULT_BLEED,
      y: grid.originY + row * grid.cellH + DEFAULT_BLEED,
      width: cardSize.width,
      height: cardSize.height,
    }
  })
}

export function roundedRectPoints(
  rect: TrimRect,
  cornerRadiusPt: number,
): Array<{ x: number; y: number }> {
  const radius = Math.min(
    Math.max(0, Number.isFinite(cornerRadiusPt) ? cornerRadiusPt : 0),
    rect.width / 2,
    rect.height / 2,
  )

  if (radius === 0) {
    return [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.width, y: rect.y },
      { x: rect.x + rect.width, y: rect.y + rect.height },
      { x: rect.x, y: rect.y + rect.height },
    ]
  }

  const corners = [
    { x: rect.x + rect.width - radius, y: rect.y + radius, start: -90 },
    {
      x: rect.x + rect.width - radius,
      y: rect.y + rect.height - radius,
      start: 0,
    },
    { x: rect.x + radius, y: rect.y + rect.height - radius, start: 90 },
    { x: rect.x + radius, y: rect.y + radius, start: 180 },
  ]

  return corners.flatMap(({ x, y, start }) =>
    Array.from({ length: 9 }, (_, index) => {
      const angle = ((start + (90 * index) / 8) * Math.PI) / 180

      return {
        x: x + radius * Math.cos(angle),
        y: y + radius * Math.sin(angle),
      }
    }),
  )
}
