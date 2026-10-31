import { DEFAULT_BLEED, mmToPt, type Point, type Size } from './geometry.ts'

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

export type CornerLabelBox = {
  axis: 'horizontal' | 'vertical'
  text: string
  left: number
  top: number
  width: number
  height: number
}

function roundThousandth(value: number): number {
  return Math.round(value * 1000) / 1000
}

export function cornerLabelBoxes(
  mark: Point,
  paper: Size,
): CornerLabelBox[] {
  void paper
  const halfLength = mmToPt(5)
  const labelOffset = halfLength + 7
  const width = 7
  const height = 7

  return [
    {
      axis: 'horizontal',
      text: '-5',
      left: mark.x - labelOffset - width / 2,
      top: mark.y - height / 2,
      width,
      height,
    },
    {
      axis: 'horizontal',
      text: '5',
      left: mark.x + labelOffset - width / 2,
      top: mark.y - height / 2,
      width,
      height,
    },
    {
      axis: 'vertical',
      text: '-5',
      left: mark.x - width / 2,
      top: mark.y - labelOffset - height / 2,
      width,
      height,
    },
    {
      axis: 'vertical',
      text: '5',
      left: mark.x - width / 2,
      top: mark.y + labelOffset - height / 2,
      width,
      height,
    },
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

export function foldGuideXs(paperWidthPt: number): { left: number; right: number } {
  const centerX = paperWidthPt / 2
  const scaleHalfWidth = mmToPt(100)
  return {
    left: roundThousandth(centerX - scaleHalfWidth),
    right: roundThousandth(centerX + scaleHalfWidth),
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
  const gaugeBottomOffset = 11
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
