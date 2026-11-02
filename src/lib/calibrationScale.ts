import {
  applyCalibration,
  DEFAULT_BLEED,
  mmToPt,
  type Point,
  type Size,
} from './geometry.ts'
import type { Calibration, Grid } from './layout.ts'

export const SHEET_WIDTH_MM = {
  LETTER: 215.9,
  A4: 210,
} as const

export function expectedScaleGapSpaces(sheetWidthMm: number): number {
  return sheetWidthMm - 200
}

export type ScaleTick = {
  mm: number
  kind: 'minor' | 'mid' | 'major'
  label?: string
} & (
  | { xPt: number; offsetPt?: never }
  | { offsetPt: number; xPt?: never }
)

export type CalibrationLabelBox = {
  left: number
  top: number
  width: number
  height: number
  fontSize: number
}

export type FoldGuideLabelBox = CalibrationLabelBox & {
  textAlign: 'left' | 'right'
}

export type CornerLabelBox = {
  axis: 'horizontal' | 'vertical'
  text: string
  left: number
  top: number
  width: number
  height: number
  fontSize: number
}

export type TrimRect = {
  left: number
  top: number
  width: number
  height: number
}

const SCALE_LABEL_FONT_SIZE = 4.5
const SCALE_LABEL_DIGIT_WIDTH = 0.556 * SCALE_LABEL_FONT_SIZE

export function trimRects(
  grid: Grid,
  cardSize: Size,
  calibration: Calibration,
  side: 'front' | 'back',
): TrimRect[] {
  const rects: TrimRect[] = []

  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      const cellCol = side === 'front' ? col : grid.cols - 1 - col
      const cellOrigin = applyCalibration(
        {
          x: grid.originX + cellCol * grid.cellW,
          y: grid.originY + row * grid.cellH,
        },
        calibration,
      )[side]
      rects.push({
        left: cellOrigin.x + DEFAULT_BLEED,
        top: cellOrigin.y + DEFAULT_BLEED,
        width: cardSize.width,
        height: cardSize.height,
      })
    }
  }

  return rects
}

function roundThousandth(value: number): number {
  return Math.round(value * 1000) / 1000
}

export function cornerLabelBoxes(
  mark: Point,
  paper: Size,
): CornerLabelBox[] {
  const halfLength = mmToPt(5)
  const labelOffset = halfLength + 7
  const fontSize = SCALE_LABEL_FONT_SIZE
  const height = 7
  const horizontalLabel = (text: string, direction: -1 | 1): CornerLabelBox => {
    const width = text.length * SCALE_LABEL_DIGIT_WIDTH
    const desiredLeft =
      mark.x + direction * labelOffset - width / 2
    const left = Math.max(14, Math.min(paper.width - 14 - width, desiredLeft))

    return {
      axis: 'horizontal',
      text,
      left,
      top: mark.y - 5 - height,
      width,
      height,
      fontSize,
    }
  }
  const verticalLabel = (text: string, direction: -1 | 1): CornerLabelBox => {
    const width = text.length * SCALE_LABEL_DIGIT_WIDTH
    const desiredTop = mark.y + direction * labelOffset - height / 2

    return {
      axis: 'vertical',
      text,
      left: mark.x + 5,
      top: Math.max(14, Math.min(paper.height - 14 - height, desiredTop)),
      width,
      height,
      fontSize,
    }
  }

  return [
    horizontalLabel('-5', -1),
    horizontalLabel('5', 1),
    verticalLabel('-5', -1),
    verticalLabel('5', 1),
  ]
}

export function fullWidthScaleTicks(paperWidthPt: number): ScaleTick[] {
  return Array.from({ length: 201 }, (_, index) => {
    const mm = index - 100
    const kind = mm % 10 === 0 ? 'major' : mm % 5 === 0 ? 'mid' : 'minor'

    return {
      mm,
      xPt: roundThousandth(paperWidthPt / 2 + mmToPt(mm)),
      kind,
      ...(kind === 'major' ? { label: String(mm) } : {}),
    }
  })
}

export function fullWidthScaleLabelBox(
  tick: ScaleTick,
  y: number,
): CalibrationLabelBox {
  const width = 26
  const x = tick.xPt ?? 0

  return {
    left:
      tick.mm === -100
        ? x + 3
        : tick.mm === 100
          ? x - width - 3
          : x - width / 2,
    top: y + (Math.abs(tick.mm) === 100 ? 8 : 5),
    width,
    height: Math.abs(tick.mm) === 100 ? 7 : 9,
    fontSize: Math.abs(tick.mm) === 100 ? 5 : 6,
  }
}

export function fullWidthScaleTickLength(tick: ScaleTick): number {
  if (Math.abs(tick.mm) === 100) return 14
  return tick.kind === 'major' ? 8 : tick.kind === 'mid' ? 5 : 3
}

export function foldGuideXs(paperWidthPt: number): { left: number; right: number } {
  const centerX = paperWidthPt / 2
  const scaleHalfWidth = mmToPt(100)
  return {
    left: roundThousandth(centerX - scaleHalfWidth),
    right: roundThousandth(centerX + scaleHalfWidth),
  }
}

export function foldGuideLabelBox(
  paperWidthPt: number,
  y: number,
  side: 'left' | 'right',
): FoldGuideLabelBox {
  const x = foldGuideXs(paperWidthPt)[side]
  const width = 36
  const labelOffset = 45

  return {
    left: side === 'left' ? x + labelOffset : x - labelOffset - width,
    top: Math.max(17, y - 22),
    width,
    height: 8,
    fontSize: 5,
    textAlign: side === 'left' ? 'left' : 'right',
  }
}

export type ScaleGaugeTick = {
  mm: number
  xPt: number
  kind: 'minor' | 'mid' | 'major'
  label?: string
}

export function scaleGaugeTicks(
  paperWidthPt: number,
  side: 'left' | 'right',
): ScaleGaugeTick[] {
  const foldX = foldGuideXs(paperWidthPt)[side]

  return Array.from({ length: 29 }, (_, index) => {
    const mm = index / 2
    const kind =
      mm % 2 === 0 ? 'major' : Number.isInteger(mm) ? 'mid' : 'minor'

    return {
      mm,
      xPt: roundThousandth(foldX + (side === 'left' ? 1 : -1) * mmToPt(mm)),
      kind,
      ...(kind === 'major' ? { label: String(mm) } : {}),
    }
  })
}

export function scaleGaugeLabelBoxes(
  paperWidthPt: number,
  side: 'left' | 'right',
  y: number,
): (CalibrationLabelBox & { mm: number; text: string })[] {
  const fontSize = SCALE_LABEL_FONT_SIZE
  const digitWidth = SCALE_LABEL_DIGIT_WIDTH

  return scaleGaugeTicks(paperWidthPt, side)
    .filter((tick) => tick.label !== undefined)
    .map((tick) => {
      const text = tick.label!
      const width = text.length * digitWidth

      return {
        mm: tick.mm,
        text,
        left: tick.xPt - width / 2,
        top: y + (tick.mm <= 8 ? 5 : 11),
        width,
        height: 7,
        fontSize,
      }
    })
}

export function cornerScaleTicks(): ScaleTick[] {
  return Array.from({ length: 21 }, (_, index) => {
    const mm = (index - 10) / 2
    const kind =
      mm === 0 ? 'major' : Number.isInteger(mm) ? 'mid' : 'minor'

    return {
      mm,
      offsetPt: roundThousandth(mmToPt(mm)),
      kind,
      ...(Math.abs(mm) === 5 ? { label: String(mm) } : {}),
    }
  })
}

export function estimatePrintScale(input: {
  sheetWidthMm: number
  gapSpaces: number
}): { scale: number; verdict: 'OK' | 'TOO_SMALL' | 'TOO_LARGE' } {
  const { sheetWidthMm, gapSpaces } = input
  if (
    !Number.isFinite(sheetWidthMm) ||
    !Number.isFinite(gapSpaces) ||
    sheetWidthMm < 0 ||
    gapSpaces < 0
  ) {
    throw new RangeError('Sheet width and gap spaces must be finite and non-negative.')
  }

  const scale = sheetWidthMm / (200 + gapSpaces)
  const verdict =
    scale < 0.99 ? 'TOO_SMALL' : scale > 1.01 ? 'TOO_LARGE' : 'OK'
  return { scale, verdict }
}

export function estimatePrintScaleFromRuler(
  measuredMm: number,
): { scale: number; verdict: 'OK' | 'TOO_SMALL' | 'TOO_LARGE' } {
  if (!Number.isFinite(measuredMm) || measuredMm <= 0) {
    throw new RangeError('Measured distance must be finite and positive.')
  }

  const scale = measuredMm / 200
  const verdict =
    scale < 0.99 ? 'TOO_SMALL' : scale > 1.01 ? 'TOO_LARGE' : 'OK'
  return { scale, verdict }
}

export function scaleEstimatesDisagree(first: number, second: number): boolean {
  return Math.abs(first - second) > 0.015 + Number.EPSILON
}

export function scaleBandY({
  paperHeightPt,
  firstTrimTopPt,
  lastTrimBottomPt,
  backOffsetY = 0,
}: {
  paperHeightPt: number
  firstTrimTopPt: number
  lastTrimBottomPt: number
  backOffsetY?: number
}): number | null {
  const edgeClearance = 17
  const trimClearance = 6
  const tickHalfHeight = 4
  const labelBottomOffset = 14
  const topSafeLineY = edgeClearance + tickHalfHeight
  const bottomSafeLineY = paperHeightPt - edgeClearance - labelBottomOffset
  const topLineY = Math.max(topSafeLineY, topSafeLineY - backOffsetY, 30)

  if (
    Number.isFinite(paperHeightPt) &&
    Number.isFinite(firstTrimTopPt) &&
    Number.isFinite(backOffsetY) &&
    topLineY - tickHalfHeight >= edgeClearance &&
    topLineY + labelBottomOffset + trimClearance <= firstTrimTopPt
  ) {
    return topLineY
  }

  const bottomLineY = Math.min(bottomSafeLineY, bottomSafeLineY - backOffsetY)
  if (
    Number.isFinite(paperHeightPt) &&
    Number.isFinite(lastTrimBottomPt) &&
    Number.isFinite(backOffsetY) &&
    bottomLineY - tickHalfHeight >= lastTrimBottomPt + trimClearance
  ) {
    return bottomLineY
  }

  return null
}

export function calibrationScaleY({
  paper,
  grid,
  cardSize,
  backOffsetY,
}: {
  paper: Size
  grid: { originY: number; rows: number; cellH: number }
  cardSize: Size
  backOffsetY: number
}): number | null {
  return scaleBandY({
    paperHeightPt: paper.height,
    firstTrimTopPt: grid.originY + DEFAULT_BLEED,
    lastTrimBottomPt:
      grid.originY +
      (grid.rows - 1) * grid.cellH +
      DEFAULT_BLEED +
      cardSize.height,
    backOffsetY,
  })
}

export function calibrationScaleGaugeY({
  paper,
  grid,
  cardSize,
  backOffsetY,
}: {
  paper: Size
  grid: { originY: number; rows: number; cellH: number }
  cardSize: Size
  backOffsetY: number
}): number | null {
  const scaleY = calibrationScaleY({ paper, grid, cardSize, backOffsetY })
  if (scaleY === null) return null

  const firstTrimTopPt = grid.originY + DEFAULT_BLEED
  const lastTrimBottomPt =
    grid.originY +
    (grid.rows - 1) * grid.cellH +
    DEFAULT_BLEED +
    cardSize.height
  const gaugeTopOffset = 5
  const gaugeBottomOffset = 16
  const trimClearance = 6
  const edgeClearance = 17

  for (const gaugeY of [scaleY + 20, scaleY - 20]) {
    const gaugeTop = gaugeY - gaugeTopOffset
    const gaugeBottom = gaugeY + gaugeBottomOffset
    const fitsTopBand =
      gaugeTop >= edgeClearance &&
      gaugeBottom + trimClearance <= firstTrimTopPt
    const fitsBottomBand =
      gaugeTop >= lastTrimBottomPt + trimClearance &&
      paper.height - gaugeBottom >= edgeClearance

    if (fitsTopBand || fitsBottomBand) return roundThousandth(gaugeY)
  }

  return null
}
