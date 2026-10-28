import type { Size } from './geometry.ts'
import { roundedRectPoints, trimRects, type CutRectsInput } from './cutRects.ts'

const pointsPerMillimetre = 72 / 25.4

export function buildCutDxf({
  paper,
  grid,
  cardSize,
  count,
  cornerRadiusPt = 0,
}: CutRectsInput & { paper: Size; cornerRadiusPt?: number }): string {
  const lines = [
    '999',
    'Units: millimetres',
    '999',
    'R12 (AC1009)',
    '0',
    'SECTION',
    '2',
    'TABLES',
    '0',
    'TABLE',
    '2',
    'LAYER',
    '70',
    '1',
    '0',
    'LAYER',
    '2',
    'CUT',
    '70',
    '0',
    '62',
    '7',
    '6',
    'CONTINUOUS',
    '0',
    'ENDTAB',
    '0',
    'ENDSEC',
    '0',
    'SECTION',
    '2',
    'ENTITIES',
  ]

  for (const rect of trimRects({ grid, cardSize, count })) {
    lines.push('0', 'POLYLINE', '8', 'CUT', '66', '1', '70', '1')

    for (const point of roundedRectPoints(rect, cornerRadiusPt)) {
      lines.push(
        '0',
        'VERTEX',
        '8',
        'CUT',
        '10',
        ((point.x / pointsPerMillimetre)).toFixed(3),
        '20',
        (((paper.height - point.y) / pointsPerMillimetre)).toFixed(3),
        '30',
        '0',
      )
    }

    lines.push('0', 'SEQEND', '8', 'CUT')
  }

  lines.push('0', 'ENDSEC', '0', 'EOF')
  return `${lines.join('\n')}\n`
}
