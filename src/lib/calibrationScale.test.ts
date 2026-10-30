import { describe, expect, it } from 'vitest'
import {
  cornerLabelBoxes,
  calibrationScaleY,
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
  mmToPt,
  PAPER,
  type Point,
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

  function intersects(
    first: { left: number; top: number; width: number; height: number },
    second: { left: number; top: number; width: number; height: number },
  ): boolean {
    return (
      first.left < second.left + second.width &&
      first.left + first.width > second.left &&
      first.top < second.top + second.height &&
      first.top + first.height > second.top
    )
  }

  function crosshairLines(mark: Point): {
    left: number
    top: number
    width: number
    height: number
  }[] {
    const arm = mmToPt(6)

    return [
      { left: mark.x - arm, top: mark.y - 0.125, width: 2 * arm, height: 0.25 },
      { left: mark.x - 0.125, top: mark.y - arm, width: 0.25, height: 2 * arm },
    ]
  }

  describe('cornerLabelBoxes', () => {
    for (const [paperName, paper] of Object.entries(PAPER)) {
      for (const isLeft of [true, false]) {
        for (const isTop of [true, false]) {
          it(`places four clear endpoint labels for ${paperName} ${
            isTop ? 'top' : 'bottom'
          }-${isLeft ? 'left' : 'right'}`, () => {
            const mark = {
              x: paper.width * (isLeft ? 0.1 : 0.9),
              y: paper.height * (isTop ? 0.1 : 0.9),
            }
            const labels = cornerLabelBoxes(mark, paper)
            const crosshairs = crosshairLines(mark)
            const arm = mmToPt(5)
            const trimLines = [
              {
                left: isLeft ? mark.x : mark.x - 100,
                top: mark.y - 0.125,
                width: 100,
                height: 0.25,
              },
              {
                left: mark.x - 0.125,
                top: isTop ? mark.y : mark.y - 100,
                width: 0.25,
                height: 100,
              },
            ]
            const markCircle = {
              left: mark.x - 3,
              top: mark.y - 3,
              width: 6,
              height: 6,
            }

            expect(labels).toHaveLength(4)
            expect(labels.map(({ axis, text }) => [axis, text])).toEqual([
              ['horizontal', '-5'],
              ['horizontal', '5'],
              ['vertical', '-5'],
              ['vertical', '5'],
            ])

            const trimIntersections: string[] = []
            for (let first = 0; first < labels.length; first += 1) {
              expect(intersects(labels[first], markCircle)).toBe(false)
              for (let second = first + 1; second < labels.length; second += 1) {
                expect(intersects(labels[first], labels[second])).toBe(false)
              }
              for (const line of crosshairs) {
                expect(intersects(labels[first], line)).toBe(false)
              }
              for (const line of trimLines) {
                if (intersects(labels[first], line)) {
                  trimIntersections.push(`${labels[first].axis}:${labels[first].text}`)
                }
              }

              const centerX = labels[first].left + labels[first].width / 2
              const centerY = labels[first].top + labels[first].height / 2
              const endpoint =
                labels[first].axis === 'horizontal'
                  ? mark.x + (labels[first].text === '5' ? arm : -arm)
                  : mark.y + (labels[first].text === '5' ? arm : -arm)
              const center = labels[first].axis === 'horizontal' ? centerX : centerY
              const distanceBeyondEnd =
                (center - endpoint) * (labels[first].text === '5' ? 1 : -1)

              expect(
                labels[first].axis === 'horizontal'
                  ? Math.abs(centerY - mark.y)
                  : Math.abs(centerX - mark.x),
              ).toBeLessThanOrEqual(0.5)
              expect(distanceBeyondEnd).toBeGreaterThan(0)
              expect(distanceBeyondEnd).toBeLessThanOrEqual(10)
            }
            expect(trimIntersections.sort()).toEqual(
              [
                `horizontal:${isLeft ? '5' : '-5'}`,
                `vertical:${isTop ? '5' : '-5'}`,
              ].sort(),
            )
            expect(labels.every(({ left, top, width, height }) =>
              left >= 0 &&
              top >= 0 &&
              left + width <= paper.width &&
              top + height <= paper.height,
            )).toBe(true)
          })
        }
      }
    }
  })

  it('labels only the two end ticks and leaves all other ticks unlabeled', () => {
    expect(ticks[0]).toMatchObject({ mm: -5, label: '-5' })
    expect(ticks[20]).toMatchObject({ mm: 5, label: '5' })
    expect(ticks.slice(1, -1).every(({ label }) => label === undefined)).toBe(true)
    expect(ticks[8]).toMatchObject({ mm: -1, kind: 'mid' })
    expect(ticks[9]).toMatchObject({ mm: -0.5, kind: 'minor' })
    expect(ticks[9].label).toBeUndefined()
    expect(ticks[11]).toMatchObject({ mm: 0.5, kind: 'minor' })
    expect(ticks[12]).toMatchObject({ mm: 1, kind: 'mid' })
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

describe('calibrationScaleY', () => {
  it.each(Object.entries(PAPER))(
    'matches the shared app and PDF scale band for %s with a nonzero offset',
    (_paperName, paper) => {
      const cardSize = CARD_PRESETS.POKER
      const grid = calculateGrid({ paper, card: cardSize })
      const backOffsetY = -mmToPt(10)

      expect(
        calibrationScaleY({ paper, grid, cardSize, backOffsetY }),
      ).toBe(
        scaleBandY({
          paperHeightPt: paper.height,
          firstTrimTopPt: grid.originY + DEFAULT_BLEED,
          lastTrimBottomPt:
            grid.originY +
            (grid.rows - 1) * grid.cellH +
            DEFAULT_BLEED +
            cardSize.height,
          backOffsetY,
        }),
      )
      expect(
        calibrationScaleY({ paper, grid, cardSize, backOffsetY }),
      ).not.toBe(
        calibrationScaleY({ paper, grid, cardSize, backOffsetY: 0 }),
      )
    },
  )

  it('returns null when the scale step must be hidden', () => {
    const paper = PAPER.A4
    const cardSize = CARD_PRESETS.MINI
    const grid = calculateGrid({ paper, card: cardSize })

    expect(
      calibrationScaleY({ paper, grid, cardSize, backOffsetY: 0 }),
    ).toBeNull()
  })
})

describe('scaleBandY', () => {
  const gridsWithoutScale = new Set([
    'LETTER POKER tight',
    'LETTER MINI tight',
    'A4 POKER tight',
    'A4 BRIDGE tight',
    'A4 MINI tight',
    'A4 MINI regular',
  ])
  const scaleTopOffset = 4
  const scaleBottomOffset = 14
  const edgeClearance = 17
  const trimClearance = 6

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

          const shouldSkip = gridsWithoutScale.has(
            `${paperName} ${presetName} ${gridName}`,
          )
          expect(y === null).toBe(shouldSkip)
          if (y === null) return

          expect(y - scaleTopOffset).toBeGreaterThanOrEqual(edgeClearance)
          expect(paper.height - (y + scaleBottomOffset)).toBeGreaterThanOrEqual(
            edgeClearance,
          )
          if (y === 30) {
            expect(y + scaleBottomOffset + trimClearance).toBeLessThanOrEqual(
              firstTrimTopPt,
            )
          } else {
            expect(y - scaleTopOffset).toBeGreaterThanOrEqual(
              lastTrimBottomPt + trimClearance,
            )
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

  it('keeps front and calibrated back scales clear of paper edges', () => {
    const paper = PAPER.LETTER
    const firstTrimTopPt = 135
    const lastTrimBottomPt = 657

    for (const backOffsetY of [-mmToPt(10), 0, mmToPt(10)]) {
      const y = scaleBandY({
        paperHeightPt: paper.height,
        firstTrimTopPt,
        lastTrimBottomPt,
        backOffsetY,
      })

      expect(y).not.toBeNull()
      for (const lineY of [y ?? 0, (y ?? 0) + backOffsetY]) {
        expect(lineY - scaleTopOffset).toBeGreaterThanOrEqual(edgeClearance)
        expect(paper.height - (lineY + scaleBottomOffset)).toBeGreaterThanOrEqual(
          edgeClearance,
        )
      }
    }
  })
})
