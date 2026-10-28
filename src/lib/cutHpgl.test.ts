import { describe, expect, it } from 'vitest'
import { CARD_PRESETS, calculateGrid, PAPER } from './geometry.ts'
import { buildCutHpgl } from './cutHpgl.ts'
import { trimRects } from './cutRects.ts'

const plotterUnitsPerMillimetre = 40
const pointsPerMillimetre = 72 / 25.4

function parseHpglPolygons(output: string): Array<Array<{ x: number; y: number }>> {
  return [
    ...output.matchAll(/PU (-?\d+),(-?\d+);PD ([^;]+);/g),
  ].map(([, startX, startY, coordinates]) => [
    { x: Number(startX), y: Number(startY) },
    ...coordinates
      .split(',')
      .reduce<Array<{ x: number; y: number }>>((points, value, index, values) => {
        if (index % 2 === 0) {
          points.push({ x: Number(value), y: Number(values[index + 1]) })
        }
        return points
      }, []),
  ])
}

function rectanglesFromHpgl(
  polygons: Array<Array<{ x: number; y: number }>>,
  paperHeight: number,
): Array<{ x: number; y: number; width: number; height: number }> {
  return polygons.map((points) => {
    const xs = points.map(({ x }) => x / plotterUnitsPerMillimetre)
    const ys = points.map(({ y }) => y / plotterUnitsPerMillimetre)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)

    return {
      x: minX,
      y: paperHeight - maxY,
      width: maxX - minX,
      height: maxY - minY,
    }
  })
}

describe('buildCutHpgl', () => {
  const paper = PAPER.LETTER
  const cardSize = CARD_PRESETS.POKER
  const grid = calculateGrid({ paper, card: cardSize })

  it('writes closed polygons that read back to the trim rectangles', () => {
    const count = 3
    const output = buildCutHpgl({ paper, grid, cardSize, count })
    const polygons = parseHpglPolygons(output)
    const expected = trimRects({ grid, cardSize, count }).map((rect) => ({
      x: rect.x / pointsPerMillimetre,
      y: rect.y / pointsPerMillimetre,
      width: rect.width / pointsPerMillimetre,
      height: rect.height / pointsPerMillimetre,
    }))
    const actual = rectanglesFromHpgl(polygons, paper.height / pointsPerMillimetre)

    expect(output.startsWith('IN;SP1;')).toBe(true)
    expect(output.endsWith('PU;SP0;\n')).toBe(true)
    expect(polygons).toHaveLength(count)
    expect(polygons.every((points) => points.length === 5)).toBe(true)
    expect(polygons.every(([first, ...rest]) => {
      const last = rest[rest.length - 1]
      return first.x === last.x && first.y === last.y
    })).toBe(true)
    expect(actual).toHaveLength(expected.length)

    for (let index = 0; index < expected.length; index += 1) {
      for (const dimension of ['x', 'y', 'width', 'height'] as const) {
        expect(
          Math.abs(actual[index][dimension] - expected[index][dimension]),
        ).toBeLessThanOrEqual(0.025)
      }
    }
  })

  it('flips top-row coordinates upward and emits no invalid values', () => {
    const output = buildCutHpgl({ paper, grid, cardSize, count: 4 })
    const polygons = parseHpglPolygons(output)
    const firstYs = polygons[0].map(({ y }) => y)
    const lowerYs = polygons[2].map(({ y }) => y)

    expect(Math.min(...firstYs)).toBeGreaterThan(Math.max(...lowerYs))
    expect(output).not.toMatch(/NaN|undefined|\$/)
  })

  it('preserves card bounds with rounded corners', () => {
    const output = buildCutHpgl({ paper, grid, cardSize, count: 1, cornerRadiusPt: 12 })
    const [actual] = rectanglesFromHpgl(
      parseHpglPolygons(output),
      paper.height / pointsPerMillimetre,
    )

    expect(actual.width).toBeCloseTo(cardSize.width / pointsPerMillimetre, 2)
    expect(actual.height).toBeCloseTo(cardSize.height / pointsPerMillimetre, 2)
  })
})
