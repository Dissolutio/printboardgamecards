import { describe, expect, it } from 'vitest'
import { buildCutSvg } from './cutSvg.ts'
import {
  calculateGrid,
  CARD_PRESETS,
  DEFAULT_BLEED,
  PAPER,
  type Size,
} from './geometry.ts'

const cardSize = CARD_PRESETS.POKER

function createSvg(count: number, cornerRadiusPt = 0, paper: Size = PAPER.LETTER) {
  const grid = calculateGrid({ paper, card: cardSize })
  return buildCutSvg({ paper, grid, cardSize, count, cornerRadiusPt })
}

function pathsIn(svg: string) {
  return [...svg.matchAll(/<path d="([^"]+)" fill="none" stroke="#FF0000" stroke-width="1"\/>/g)].map(
    (match) => match[1],
  )
}

describe('buildCutSvg', () => {
  it('outputs well-formed XML using only the expected SVG elements', () => {
    const svg = createSvg(1)

    expect(svg).toMatch(
      /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" version="1\.1" width="\d+\.\d{4}in" height="\d+\.\d{4}in" viewBox="0 0 [\d.]+ [\d.]+"><g id="cut-lines" fill="none">(?:<path d="[^"]+" fill="none" stroke="#FF0000" stroke-width="1"\/>)*<\/g><\/svg>$/,
    )
    expect(svg).not.toMatch(/<(?:image|text|style)\b|class=|style=|transform=|NaN|undefined|\$/)
  })

  it('emits one path per card and clamps the count to grid capacity', () => {
    expect(pathsIn(createSvg(4))).toHaveLength(4)
    expect(pathsIn(createSvg(5))).toHaveLength(4)
    expect(pathsIn(createSvg(100))).toHaveLength(4)
  })

  it.each([PAPER.LETTER, PAPER.A4])('sets the physical dimensions for %#', (paper) => {
    const svg = createSvg(1, 0, paper)
    const widthInches = Number(svg.match(/width="([\d.]+)in"/)?.[1])
    const heightInches = Number(svg.match(/height="([\d.]+)in"/)?.[1])
    const viewBox = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)

    expect(widthInches * 72).toBeCloseTo(paper.width, 2)
    expect(heightInches * 72).toBeCloseTo(paper.height, 2)
    expect(Number(viewBox?.[1])).toBe(paper.width)
    expect(Number(viewBox?.[2])).toBe(paper.height)
  })

  it('starts the first path at the front trim position', () => {
    const grid = calculateGrid({ paper: PAPER.LETTER, card: cardSize })
    const firstPath = pathsIn(buildCutSvg({ paper: PAPER.LETTER, grid, cardSize, count: 1 }))[0]
    const start = firstPath.match(/^M ([\d.-]+) ([\d.-]+)/)

    expect(Number(start?.[1])).toBeCloseTo(grid.originX + DEFAULT_BLEED, 2)
    expect(Number(start?.[2])).toBeCloseTo(grid.originY + DEFAULT_BLEED, 2)
  })

  it.each([0, 30])('keeps every path bounding box equal to card size with radius %s', (radius) => {
    const svg = createSvg(4, radius)

    for (const path of pathsIn(svg)) {
      const points = [...path.matchAll(/[ML] ([\d.-]+) ([\d.-]+)/g)].map((match) => ({
        x: Number(match[1]),
        y: Number(match[2]),
      }))
      const xs = points.map(({ x }) => x)
      const ys = points.map(({ y }) => y)

      expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(cardSize.width, 2)
      expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(cardSize.height, 2)
    }
  })

  it('uses square commands for zero radius and clamps oversized rounded corners', () => {
    const squarePath = pathsIn(createSvg(1))[0]
    const roundedPath = pathsIn(createSvg(1, 1000))[0]

    expect(squarePath).toMatch(/^[MLZ0-9. ]+$/)
    expect(squarePath).not.toContain('A')
    expect(roundedPath).toContain('A')
    expect(roundedPath).toContain(
      `A ${(cardSize.width / 2).toFixed(2)} ${(cardSize.width / 2).toFixed(2)}`,
    )
  })
})
