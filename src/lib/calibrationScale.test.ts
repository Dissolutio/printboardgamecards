import { describe, expect, it } from 'vitest'
import {
  cornerLabelBoxes,
  cornerScaleTicks,
  estimatePrintScale,
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

  it('labels integer ticks and leaves half-millimeter ticks unlabeled', () => {
    expect(ticks[8]).toMatchObject({ mm: -1, kind: 'mid', label: '-1' })
    expect(ticks[9]).toMatchObject({ mm: -0.5, kind: 'minor' })
    expect(ticks[9].label).toBeUndefined()
    expect(ticks[11]).toMatchObject({ mm: 0.5, kind: 'minor' })
    expect(ticks[12]).toMatchObject({ mm: 1, kind: 'mid', label: '1' })
  })
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

function cornerTickLines(mark: Point): {
  left: number
  top: number
  width: number
  height: number
}[] {
  const halfLength = mmToPt(5)
  const ticks = cornerScaleTicks()

  return [
    { left: mark.x - halfLength, top: mark.y - 0.125, width: 2 * halfLength, height: 0.25 },
    { left: mark.x - 0.125, top: mark.y - halfLength, width: 0.25, height: 2 * halfLength },
    ...ticks.flatMap((tick) => {
      const offsetPt = tick.offsetPt ?? 0
      const length = tick.mm === 0 ? 4 : tick.kind === 'mid' ? 2.5 : 1.5

      return [
        {
          left: mark.x + offsetPt - 0.125,
          top: mark.y - length / 2,
          width: 0.25,
          height: length,
        },
        {
          left: mark.x - length / 2,
          top: mark.y + offsetPt - 0.125,
          width: length,
          height: 0.25,
        },
      ]
    }),
  ]
}

describe('cornerLabelBoxes', () => {
  for (const [paperName, paper] of Object.entries(PAPER)) {
    for (const isLeft of [true, false]) {
      for (const isTop of [true, false]) {
        it(`separates labels from each other and the ticks for ${paperName} ${
          isTop ? 'top' : 'bottom'
        }-${isLeft ? 'left' : 'right'}`, () => {
          const mark = {
            x: paper.width * (isLeft ? 0.1 : 0.9),
            y: paper.height * (isTop ? 0.1 : 0.9),
          }
          const labels = cornerLabelBoxes(mark, paper)
          const tickLines = cornerTickLines(mark)
          const trimLines = [
            {
              left: mark.x - 100,
              top: mark.y - 0.125,
              width: 200,
              height: 0.25,
            },
            {
              left: mark.x - 0.125,
              top: mark.y - 100,
              width: 0.25,
              height: 200,
            },
          ]
          const markCircle = {
            left: mark.x - 3,
            top: mark.y - 3,
            width: 6,
            height: 6,
          }

          expect(labels).toHaveLength(20)
          for (let first = 0; first < labels.length; first += 1) {
            expect(intersects(labels[first], markCircle)).toBe(false)
            for (let second = first + 1; second < labels.length; second += 1) {
              expect(intersects(labels[first], labels[second])).toBe(false)
            }
            for (const tickLine of tickLines) {
              expect(intersects(labels[first], tickLine)).toBe(false)
            }
            for (const trimLine of trimLines) {
              expect(intersects(labels[first], trimLine)).toBe(false)
            }
          }
          expect(labels.filter(({ axis }) => axis === 'horizontal').map(({ text }) => text))
            .toEqual(['-5', '-4', '-3', '-2', '-1', '1', '2', '3', '4', '5'])
          expect(labels.every(({ left, top, width, height }) =>
            left >= 0 &&
            top >= 0 &&
            left + width <= paper.width &&
            top + height <= paper.height,
          )).toBe(true)
        })
      }
    }

    it(`uses the Letter or A4 paper midpoint for ${paperName} corners`, () => {
      const left = cornerLabelBoxes(
        { x: paper.width / 2 - 1, y: paper.height / 2 - 1 },
        paper,
      )
      const right = cornerLabelBoxes(
        { x: paper.width / 2 + 1, y: paper.height / 2 + 1 },
        paper,
      )

      expect(left.find(({ axis }) => axis === 'vertical')?.left).toBeGreaterThan(
        paper.width / 2,
      )
      expect(right.find(({ axis }) => axis === 'vertical')?.left).toBeLessThan(
        paper.width / 2,
      )
      expect(left.find(({ axis }) => axis === 'horizontal')?.top).toBeGreaterThan(
        paper.height / 2,
      )
      expect(right.find(({ axis }) => axis === 'horizontal')?.top).toBeLessThan(
        paper.height / 2,
      )
    })
  }
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

  it('keeps both sides clear of the paper edges after calibration', () => {
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
