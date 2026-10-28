import type { Size } from './geometry.ts'
import { roundedRectPoints, trimRects, type CutRectsInput } from './cutRects.ts'

const plotterUnitsPerPoint = (25.4 * 40) / 72

export function buildCutHpgl({
  paper,
  grid,
  cardSize,
  count,
  cornerRadiusPt = 0,
}: CutRectsInput & { paper: Size; cornerRadiusPt?: number }): string {
  const commands = ['IN;', 'SP1;']

  for (const rect of trimRects({ grid, cardSize, count })) {
    const points = roundedRectPoints(rect, cornerRadiusPt).map((point) => ({
      x: Math.round(point.x * plotterUnitsPerPoint),
      y: Math.round((paper.height - point.y) * plotterUnitsPerPoint),
    }))
    const [first, ...rest] = points

    commands.push(`PU ${first.x},${first.y};`)
    commands.push(
      `PD ${[...rest, first].map(({ x, y }) => `${x},${y}`).join(',')};`,
    )
  }

  commands.push('PU;', 'SP0;')
  return `${commands.join('')}\n`
}
