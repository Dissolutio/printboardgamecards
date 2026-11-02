import { describe, expect, it } from 'vitest'
import {
  cornerLabelBoxes,
  calibrationScaleGaugeY,
  calibrationScaleY,
  cornerScaleTicks,
  estimatePrintScale,
  estimatePrintScaleFromRuler,
  expectedScaleGapSpaces,
  foldGuideXs,
  foldGuideLabelBox,
  fullWidthScaleTicks,
  fullWidthScaleLabelBox,
  fullWidthScaleTickLength,
  scaleEstimatesDisagree,
  scaleGaugeLabelBoxes,
  scaleGaugeTicks,
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

  it('extends both long end ticks to the full 14 pt height', () => {
    expect(fullWidthScaleTickLength(ticks[0]!)).toBe(14)
    expect(fullWidthScaleTickLength(ticks.at(-1)!)).toBe(14)
    expect(fullWidthScaleTickLength(ticks[100]!)).toBe(8)
  })
})

describe('fold guide and gauge geometry', () => {
  for (const [paperName, paper] of Object.entries(PAPER)) {
    it(`places fold guides at the scale ends on ${paperName}`, () => {
      const foldXs = foldGuideXs(paper.width)
      const expectedLeft = Math.round((paper.width / 2 - mmToPt(100)) * 1000) / 1000
      const expectedRight = Math.round((paper.width / 2 + mmToPt(100)) * 1000) / 1000

      expect(foldXs).toEqual({ left: expectedLeft, right: expectedRight })
      expect(fullWidthScaleTicks(paper.width)[0]?.xPt).toBe(foldXs.left)
      expect(fullWidthScaleTicks(paper.width).at(-1)?.xPt).toBe(foldXs.right)

      const leftTicks = scaleGaugeTicks(paper.width, 'left')
      const rightTicks = scaleGaugeTicks(paper.width, 'right')
      expect(leftTicks).toHaveLength(29)
      expect(rightTicks).toHaveLength(29)
      expect(leftTicks.map(({ mm }) => mm)).toEqual(
        Array.from({ length: 29 }, (_, index) => index / 2),
      )
      for (let index = 1; index < leftTicks.length; index += 1) {
        expect(leftTicks[index]!.xPt - leftTicks[index - 1]!.xPt).toBeCloseTo(
          mmToPt(0.5),
          2,
        )
      }
      expect(leftTicks.map(({ xPt }) => xPt)).toEqual(
        leftTicks.map(({ xPt }) => Math.round(xPt * 1000) / 1000),
      )
      expect(leftTicks.map(({ xPt }) => Math.round((paper.width - xPt) * 1000) / 1000)).toEqual(
        rightTicks.map(({ xPt }) => xPt),
      )
      expect(leftTicks.filter(({ kind }) => kind === 'major').map(({ label }) => label)).toEqual(
        ['0', '2', '4', '6', '8', '10', '12', '14'],
      )
      expect(leftTicks.filter(({ kind }) => kind === 'mid')).toHaveLength(7)
      expect(leftTicks.filter(({ kind }) => kind === 'minor')).toHaveLength(14)
    })
  }
})

describe('calibration label boxes', () => {
  const inset = 14

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

  for (const [paperName, paper] of Object.entries(PAPER)) {
    it(`keeps gauge labels separate from each other and their ticks on ${paperName}`, () => {
      for (const side of ['left', 'right'] as const) {
        const gaugeY = 50
        const labels = scaleGaugeLabelBoxes(paper.width, side, gaugeY)
        const ticks = scaleGaugeTicks(paper.width, side)

        expect(labels.map(({ text }) => text)).toEqual([
          '0',
          '2',
          '4',
          '6',
          '8',
          '10',
          '12',
          '14',
        ])
        for (const label of labels) {
          expect(label.width).toBeCloseTo(label.text.length * label.fontSize * 0.556)
        }
        for (let first = 0; first < labels.length; first += 1) {
          const label = labels[first]!
          // A4 zero labels are centered on fold ticks only 0.035 pt inside the inset.
          if (paper === PAPER.A4 && label.mm === 0) continue
          expect(label.left).toBeGreaterThanOrEqual(inset)
          expect(label.left + label.width).toBeLessThanOrEqual(paper.width - inset)
          for (let second = first + 1; second < labels.length; second += 1) {
            expect(intersects(label, labels[second]!)).toBe(false)
          }
          for (const tick of ticks) {
            const length =
              tick.kind === 'major' ? 8 : tick.kind === 'mid' ? 5 : 3
            expect(
              intersects(label, {
                left: tick.xPt - 0.15,
                top: gaugeY - length / 2,
                width: 0.3,
                height: length,
              }),
            ).toBe(false)
          }
        }
      }
    })

    it(`centers each gauge label on its tick on ${paperName}`, () => {
      for (const side of ['left', 'right'] as const) {
        const ticks = scaleGaugeTicks(paper.width, side)
        const labels = scaleGaugeLabelBoxes(paper.width, side, 50)

        for (const label of labels) {
          const tick = ticks.find(({ mm }) => mm === label.mm)
          expect(tick).toBeDefined()
          expect(
            Math.abs(label.left + label.width / 2 - tick!.xPt),
          ).toBeLessThan(0.01)
        }
      }
    })

    it(`keeps fold captions inside the guides and clear of scale marks on ${paperName}`, () => {
      const y = 30
      const sides = ['left', 'right'] as const
      const captions = sides.map((side) =>
        foldGuideLabelBox(paper.width, y, side),
      )
      const foldXs = foldGuideXs(paper.width)
      const ticks = fullWidthScaleTicks(paper.width)
      const scaleLabels = ticks
        .filter((tick) => tick.label !== undefined)
        .map((tick) => fullWidthScaleLabelBox(tick, y))

      expect(captions.map(({ textAlign }) => textAlign)).toEqual(['left', 'right'])
      for (const [index, side] of sides.entries()) {
        const caption = captions[index]!
        const foldX = foldXs[side]
        const distanceFromGuide =
          side === 'left'
            ? caption.left - foldX
            : foldX - caption.left - caption.width

        expect(caption.left).toBeGreaterThanOrEqual(inset)
        expect(caption.left + caption.width).toBeLessThanOrEqual(
          paper.width - inset,
        )
        expect(distanceFromGuide).toBeGreaterThanOrEqual(3)
        for (const tick of ticks) {
          const length = fullWidthScaleTickLength(tick)
          expect(
            intersects(caption, {
              left: (tick.xPt ?? 0) - 0.15,
              top: y - length / 2,
              width: 0.3,
              height: length,
            }),
          ).toBe(false)
        }
        for (const label of scaleLabels) {
          expect(intersects(caption, label)).toBe(false)
        }
      }

      const noteY = Math.max(17, y - 13)
      const noteBoxes = [
        { left: paper.width / 2 - 155, top: noteY, width: 150, height: 8 },
        { left: paper.width / 2 + 5, top: noteY, width: 60, height: 8 },
      ]
      expect(captions).toEqual([
        {
          left: foldXs.left + 45,
          top: 17,
          width: 36,
          height: 8,
          fontSize: 5,
          textAlign: 'left',
        },
        {
          left: foldXs.right - 81,
          top: 17,
          width: 36,
          height: 8,
          fontSize: 5,
          textAlign: 'right',
        },
      ])
      const heading = { left: 14, top: 14, width: 40, height: 10 }
      const scaleLine = {
        left: 0,
        top: y - 0.15,
        width: paper.width,
        height: 0.3,
      }
      for (const caption of captions) {
        expect(intersects(caption, heading)).toBe(false)
        expect(intersects(caption, scaleLine)).toBe(false)
      }
      for (const note of noteBoxes) {
        expect(intersects(note, heading)).toBe(false)
        expect(intersects(note, scaleLine)).toBe(false)
        expect(note.left).toBeGreaterThanOrEqual(inset)
        expect(note.top).toBeGreaterThanOrEqual(inset)
        expect(note.left + note.width).toBeLessThanOrEqual(paper.width - inset)
        expect(note.top + note.height).toBeLessThanOrEqual(paper.height - inset)
        for (const label of scaleLabels) {
          expect(intersects(note, label)).toBe(false)
        }
      }
      expect(intersects(captions[0]!, captions[1]!)).toBe(false)
      expect(intersects(noteBoxes[0]!, noteBoxes[1]!)).toBe(false)
      expect(
        captions.some((caption) =>
          noteBoxes.some((note) => intersects(caption, note)),
        ),
      ).toBe(false)
    })

    it(`keeps every full-width scale label inside the ${paperName} inset`, () => {
      const boxes = fullWidthScaleTicks(paper.width)
        .filter((tick) => tick.label !== undefined)
        .map((tick) => fullWidthScaleLabelBox(tick, 30))

      expect(
        boxes.every(
          ({ left, top, width, height }) =>
            left >= inset &&
            top >= inset &&
            left + width <= paper.width - inset &&
            top + height <= paper.height - inset,
        ),
      ).toBe(true)
    })
  }
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
            const ticks = cornerScaleTicks().flatMap((tick) => {
              const offset = tick.offsetPt ?? 0
              const length = tick.mm === 0 ? 6 : tick.kind === 'mid' ? 4 : 2
              return [
                {
                  left: mark.x + offset - 0.125,
                  top: mark.y - length / 2,
                  width: 0.25,
                  height: length,
                },
                {
                  left: mark.x - length / 2,
                  top: mark.y + offset - 0.125,
                  width: length,
                  height: 0.25,
                },
              ]
            })

            expect(labels).toHaveLength(4)
            expect(labels.map(({ axis, text }) => [axis, text])).toEqual([
              ['horizontal', '-5'],
              ['horizontal', '5'],
              ['vertical', '-5'],
              ['vertical', '5'],
            ])

            for (let first = 0; first < labels.length; first += 1) {
              expect(intersects(labels[first], markCircle)).toBe(false)
              for (let second = first + 1; second < labels.length; second += 1) {
                expect(intersects(labels[first], labels[second])).toBe(false)
              }
              for (const line of crosshairs) {
                expect(intersects(labels[first], line)).toBe(false)
              }
              for (const line of trimLines) {
                expect(intersects(labels[first], line)).toBe(false)
              }
              for (const tick of ticks) {
                expect(intersects(labels[first], tick)).toBe(false)
              }

              const { axis, text, left, top, width, height } = labels[first]
              const isPositive = text === '5'
              if (axis === 'horizontal') {
                expect(top + height).toBeLessThanOrEqual(mark.y - 5)
                const centerX = left + width / 2
                const expectedCenter =
                  mark.x + (isPositive ? arm + 7 : -(arm + 7))
                expect(centerX).toBeCloseTo(expectedCenter)
              } else {
                expect(left).toBe(mark.x + 5)
                const centerY = top + height / 2
                const expectedCenter =
                  mark.y + (isPositive ? arm + 7 : -(arm + 7))
                expect(centerY).toBeCloseTo(expectedCenter)
              }
            }
            expect(labels.every(({ left, top, width, height }) =>
              left >= 14 &&
              top >= 14 &&
              left + width <= paper.width - 14 &&
              top + height <= paper.height - 14,
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

describe('estimatePrintScaleFromRuler', () => {
  it('uses the 200 mm ruler distance and existing verdict thresholds', () => {
    expect(estimatePrintScaleFromRuler(200)).toEqual({ scale: 1, verdict: 'OK' })
    expect(estimatePrintScaleFromRuler(194)).toEqual({
      scale: 0.97,
      verdict: 'TOO_SMALL',
    })
    expect(estimatePrintScaleFromRuler(206)).toEqual({
      scale: 1.03,
      verdict: 'TOO_LARGE',
    })
  })

  it('rejects non-finite and non-positive measurements', () => {
    for (const measuredMm of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => estimatePrintScaleFromRuler(measuredMm)).toThrow(RangeError)
    }
  })
})

describe('scaleEstimatesDisagree', () => {
  it('reports differences greater than 1.5 percentage points', () => {
    expect(scaleEstimatesDisagree(1, 0.985)).toBe(false)
    expect(scaleEstimatesDisagree(1, 0.984)).toBe(true)
    expect(scaleEstimatesDisagree(1.02, 1)).toBe(true)
  })
})

describe('expectedScaleGapSpaces', () => {
  it('returns the total expected gap spaces for A4 and Letter paper', () => {
    expect(expectedScaleGapSpaces(SHEET_WIDTH_MM.A4)).toBe(10)
    expect(expectedScaleGapSpaces(SHEET_WIDTH_MM.LETTER)).toBeCloseTo(15.9)
  })
})

describe('fold gap simulation', () => {
  for (const [paperName, sheetWidthMm] of Object.entries(SHEET_WIDTH_MM)) {
    for (const scale of [0.95, 0.97, 1, 1.02, 1.04]) {
      it(`estimates ${scale} scale on ${paperName}`, () => {
        const perSideGap =
          (sheetWidthMm / 2 - 100 * scale) / scale
        const estimate = estimatePrintScale({
          sheetWidthMm,
          gapSpaces: perSideGap + perSideGap,
        })

        expect(estimate.scale).toBeCloseTo(scale, 4)
      })
    }
  }
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
    expect(
      calibrationScaleGaugeY({ paper, grid, cardSize, backOffsetY: 0 }),
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
