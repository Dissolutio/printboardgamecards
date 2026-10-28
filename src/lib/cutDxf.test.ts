import { describe, expect, it } from 'vitest'
import { CARD_PRESETS, calculateGrid, PAPER } from './geometry.ts'
import { buildCutDxf } from './cutDxf.ts'
import { trimRects } from './cutRects.ts'

const pointsPerMillimetre = 72 / 25.4

function parseDxfPolylines(output: string): Array<Array<{ x: number; y: number }>> {
  const lines = output.trimEnd().split('\n')
  const polylines: Array<Array<{ x: number; y: number }>> = []
  let current: Array<{ x: number; y: number }> | undefined

  for (let index = 0; index < lines.length; index += 2) {
    const code = lines[index]
    const value = lines[index + 1]

    if (code === '0' && value === 'POLYLINE') {
      current = []
      polylines.push(current)
    } else if (code === '0' && value === 'VERTEX' && current) {
      let x = 0
      let y = 0
      for (let vertexIndex = index + 2; vertexIndex < lines.length; vertexIndex += 2) {
        const vertexCode = lines[vertexIndex]
        if (vertexCode === '0') break
        if (vertexCode === '10') x = Number(lines[vertexIndex + 1])
        if (vertexCode === '20') y = Number(lines[vertexIndex + 1])
      }
      current.push({ x, y })
    } else if (code === '0' && value === 'SEQEND') {
      current = undefined
    }
  }

  return polylines
}

function rectanglesFromDxf(
  polylines: Array<Array<{ x: number; y: number }>>,
  paperHeight: number,
): Array<{ x: number; y: number; width: number; height: number }> {
  return polylines.map((points) => {
    const xs = points.map(({ x }) => x)
    const ys = points.map(({ y }) => y)
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

describe('buildCutDxf', () => {
  const paper = PAPER.LETTER
  const cardSize = CARD_PRESETS.POKER
  const grid = calculateGrid({ paper, card: cardSize })

  it('writes R12 closed polylines that read back to the trim rectangles', () => {
    const count = 3
    const output = buildCutDxf({ paper, grid, cardSize, count })
    const polylines = parseDxfPolylines(output)
    const expected = trimRects({ grid, cardSize, count }).map((rect) => ({
      x: rect.x / pointsPerMillimetre,
      y: rect.y / pointsPerMillimetre,
      width: rect.width / pointsPerMillimetre,
      height: rect.height / pointsPerMillimetre,
    }))
    const actual = rectanglesFromDxf(polylines, paper.height / pointsPerMillimetre)

    expect(output.startsWith('999\nUnits: millimetres\n')).toBe(true)
    expect(output).toContain('999\nR12 (AC1009)')
    expect(output.trimEnd().endsWith('0\nEOF')).toBe(true)
    expect(polylines).toHaveLength(count)
    expect(
      output.match(/0\nPOLYLINE\n8\nCUT\n66\n1\n70\n1/g),
    ).toHaveLength(count)
    expect(polylines.every((points) => points.length === 4)).toBe(true)
    expect(actual).toHaveLength(expected.length)

    for (let index = 0; index < expected.length; index += 1) {
      for (const dimension of ['x', 'y', 'width', 'height'] as const) {
        expect(actual[index][dimension]).toBeCloseTo(expected[index][dimension], 2)
      }
    }
  })

  it('writes a metric header, continuous linetype, and R12 polyline elevations', () => {
    const output = buildCutDxf({ paper, grid, cardSize, count: 2 })
    const sections = [...output.matchAll(/0\nSECTION\n2\n([A-Z]+)\n/g)].map(
      ([, name]) => name,
    )

    expect(sections).toEqual(['HEADER', 'TABLES', 'ENTITIES'])
    expect(output.indexOf('2\nHEADER\n')).toBeLessThan(output.indexOf('2\nTABLES\n'))
    expect(output).toContain(
      '9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n4\n9\n$MEASUREMENT\n70\n1\n',
    )
    expect(output).toContain(
      '0\nTABLE\n2\nLTYPE\n70\n1\n0\nLTYPE\n2\nCONTINUOUS\n70\n0\n3\nSolid line\n72\n65\n73\n0\n40\n0.0\n0\nENDTAB\n',
    )
    expect(output).toMatch(/0\nTABLE\n2\nLAYER\n70\n1\n0\nLAYER\n/)
    expect([...output.matchAll(/0\nLAYER\n/g)]).toHaveLength(1)
    expect([...output.matchAll(/0\nENDSEC\n/g)]).toHaveLength(sections.length)
    expect(output.match(/0\nPOLYLINE\n8\nCUT\n66\n1\n70\n1\n10\n0\n20\n0\n30\n0/g)).toHaveLength(2)
    expect(output.trimEnd()).toMatch(/0\nEOF$/)
  })

  it('keeps the existing coordinates for a two-card export', () => {
    const polylines = parseDxfPolylines(buildCutDxf({ paper, grid, cardSize, count: 2 }))

    expect(polylines).toEqual([
      [
        { x: 41.275, y: 231.775 },
        { x: 104.775, y: 231.775 },
        { x: 104.775, y: 142.875 },
        { x: 41.275, y: 142.875 },
      ],
      [
        { x: 111.125, y: 231.775 },
        { x: 174.625, y: 231.775 },
        { x: 174.625, y: 142.875 },
        { x: 111.125, y: 142.875 },
      ],
    ])
  })

  it('flips top-row coordinates upward and emits no invalid values', () => {
    const output = buildCutDxf({ paper, grid, cardSize, count: 4 })
    const polylines = parseDxfPolylines(output)
    const firstYs = polylines[0].map(({ y }) => y)
    const lowerYs = polylines[2].map(({ y }) => y)

    expect(Math.min(...firstYs)).toBeGreaterThan(Math.max(...lowerYs))
    expect(output).not.toMatch(/NaN|undefined/)
  })

  it('preserves card bounds with rounded corners', () => {
    const output = buildCutDxf({ paper, grid, cardSize, count: 1, cornerRadiusPt: 12 })
    const [actual] = rectanglesFromDxf(
      parseDxfPolylines(output),
      paper.height / pointsPerMillimetre,
    )

    expect(actual.width).toBeCloseTo(cardSize.width / pointsPerMillimetre, 2)
    expect(actual.height).toBeCloseTo(cardSize.height / pointsPerMillimetre, 2)
  })
})
