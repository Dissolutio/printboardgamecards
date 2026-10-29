import { describe, expect, it } from 'vitest'
import {
  cornerScaleTicks,
  estimatePrintScale,
  expectedScaleGapSpaces,
  fullWidthScaleTicks,
  scaleBandY,
  SHEET_WIDTH_MM,
} from './calibrationScale.ts'
import {
  calculateGrid,
  calculateTightGrid,
  CARD_PRESETS,
  DEFAULT_BLEED,
  PAPER,
} from './geometry.ts'

describe('fullWidthScaleTicks', () => {
  const ticks = fullWidthScaleTicks(PAPER.LETTER.width)

  it('returns 201 ticks from -100 through +100 mm', () => {
    expect(ticks).toHaveLength(201)
    expect(ticks[0]).toMatchObject({ mm: -100, kind: 'major', label: '-100' })
    expect(ticks[100]).toMatchObject({ mm: 0, kind: 'major', label: '0' })
    expect(ticks[200]).toMatchObject({ mm: 100, kind: 'major', label: '100' })
  })

  it('places zero at the page center for Letter and A4', () => {
    expect(fullWidthScaleTicks(PAPER.LETTER.width)[100].xPt).toBe(306)
    expect(fullWidthScaleTicks(PAPER.A4.width)[100].xPt).toBe(297.5)
  })

  it('labels only major ticks and limits positions to three decimals', () => {
    expect(ticks[90]).toMatchObject({ mm: -10, kind: 'major', label: '-10' })
    expect(ticks[95]).toMatchObject({ mm: -5, kind: 'mid' })
    expect(ticks[95].label).toBeUndefined()
    expect(ticks[96]).toMatchObject({ mm: -4, kind: 'minor' })
    expect(ticks[96].label).toBeUndefined()
    expect(ticks.every(({ xPt }) => Number(xPt?.toFixed(3)) === xPt)).toBe(true)
  })
})

describe('cornerScaleTicks', () => {
  const ticks = cornerScaleTicks()

  it('returns 21 half-millimeter ticks from -5 through +5 mm', () => {
    expect(ticks).toHaveLength(21)
    expect(ticks[0]).toMatchObject({ mm: -5, offsetPt: -14.173, kind: 'mid', label: '-5' })
    expect(ticks[10]).toMatchObject({ mm: 0, offsetPt: 0, kind: 'major' })
    expect(ticks[10].label).toBeUndefined()
    expect(ticks[20]).toMatchObject({ mm: 5, offsetPt: 14.173, kind: 'mid', label: '5' })
  })

  it('labels integer ticks and leaves half-millimeter ticks unlabeled', () => {
    expect(ticks[8]).toMatchObject({ mm: -1, kind: 'mid', label: '-1' })
    expect(ticks[9]).toMatchObject({ mm: -0.5, kind: 'minor' })
    expect(ticks[9].label).toBeUndefined()
    expect(ticks[11]).toMatchObject({ mm: 0.5, kind: 'minor' })
    expect(ticks[12]).toMatchObject({ mm: 1, kind: 'mid', label: '1' })
  })
})

describe('estimatePrintScale', () => {
  it('accepts A4 and Letter at actual size', () => {
    expect(
      estimatePrintScale({ sheetWidthMm: SHEET_WIDTH_MM.A4, gapSpaces: 10 }),
    ).toEqual({ scale: 1, verdict: 'OK' })
    expect(
      estimatePrintScale({ sheetWidthMm: SHEET_WIDTH_MM.LETTER, gapSpaces: 15.9 }),
    ).toEqual({ scale: 1, verdict: 'OK' })
  })

  it('detects three percent shrink and enlargement', () => {
    expect(estimatePrintScale({ sheetWidthMm: 210, gapSpaces: 210 / 0.97 - 200 })).toMatchObject({
      scale: 0.97,
      verdict: 'TOO_SMALL',
    })
    expect(estimatePrintScale({ sheetWidthMm: 210, gapSpaces: 210 / 1.03 - 200 })).toMatchObject({
      scale: 1.03,
      verdict: 'TOO_LARGE',
    })
  })

  it('accepts both one-percent boundaries', () => {
    expect(estimatePrintScale({ sheetWidthMm: 198, gapSpaces: 0 })).toEqual({
      scale: 0.99,
      verdict: 'OK',
    })
    expect(estimatePrintScale({ sheetWidthMm: 202, gapSpaces: 0 })).toEqual({
      scale: 1.01,
      verdict: 'OK',
    })
  })

  it('rejects non-finite and negative inputs', () => {
    for (const input of [
      { sheetWidthMm: Number.NaN, gapSpaces: 0 },
      { sheetWidthMm: Number.POSITIVE_INFINITY, gapSpaces: 0 },
      { sheetWidthMm: 210, gapSpaces: Number.NaN },
      { sheetWidthMm: 210, gapSpaces: Number.POSITIVE_INFINITY },
      { sheetWidthMm: -1, gapSpaces: 0 },
      { sheetWidthMm: 210, gapSpaces: -1 },
    ]) {
      expect(() => estimatePrintScale(input)).toThrow(RangeError)
    }
  })
})

describe('expectedScaleGapSpaces', () => {
  it('returns the total expected gap spaces for A4 and Letter paper', () => {
    expect(expectedScaleGapSpaces(SHEET_WIDTH_MM.A4)).toBe(10)
    expect(expectedScaleGapSpaces(SHEET_WIDTH_MM.LETTER)).toBeCloseTo(15.9)
  })
})

describe('scaleBandY', () => {
  const tightGridWithoutScale = new Set([
    'LETTER POKER',
    'LETTER MINI',
    'A4 BRIDGE',
  ])

  for (const [paperName, paper] of Object.entries(PAPER)) {
    for (const [presetName, card] of Object.entries(CARD_PRESETS)) {
      for (const [gridName, buildGrid] of [
        ['regular', () => calculateGrid({ paper, card })],
        ['tight', () => calculateTightGrid({ paper, card })],
      ] as const) {
        it(`fits ${presetName} ${gridName} grid on ${paperName}`, () => {
          const grid = buildGrid()
          const firstTrimTopPt =
            grid.originY + (gridName === 'regular' ? DEFAULT_BLEED : 0)
          const lastTrimBottomPt =
            grid.originY +
            (grid.rows - 1) * grid.cellH +
            (gridName === 'regular'
              ? DEFAULT_BLEED + card.height
              : (grid as ReturnType<typeof calculateTightGrid>).cardSize.height)
          const y = scaleBandY({
            paperHeightPt: paper.height,
            firstTrimTopPt,
            lastTrimBottomPt,
          })

          const shouldSkip =
            gridName === 'tight' && tightGridWithoutScale.has(`${paperName} ${presetName}`)
          expect(y === null).toBe(shouldSkip)
          if (y === null) return
          if (y === 30) {
            expect(y - 8).toBeGreaterThanOrEqual(22)
            expect(y + 12 + 6).toBeLessThanOrEqual(firstTrimTopPt)
          } else {
            expect(y - 8).toBeGreaterThanOrEqual(lastTrimBottomPt + 6)
            expect(y + 12 + 6).toBeLessThanOrEqual(paper.height)
          }
        })
      }
    }
  }

  it('returns null when neither band has enough room', () => {
    expect(
      scaleBandY({
        paperHeightPt: 100,
        firstTrimTopPt: 40,
        lastTrimBottomPt: 75,
      }),
    ).toBeNull()
  })
})
