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

function roundThousandth(value: number): number {
  return Math.round(value * 1000) / 1000
}

export function fullWidthScaleTicks(paperWidthPt: number): ScaleTick[] {
  return Array.from({ length: 201 }, (_, index) => {
    const mm = index - 100
    const kind = mm % 10 === 0 ? 'major' : mm % 5 === 0 ? 'mid' : 'minor'

    return {
      mm,
      xPt: roundThousandth(paperWidthPt / 2 + (mm * 72) / 25.4),
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
      offsetPt: roundThousandth((mm * 72) / 25.4),
      kind,
      ...(kind === 'mid' ? { label: String(mm) } : {}),
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

export function scaleBandY({
  paperHeightPt,
  firstTrimTopPt,
  lastTrimBottomPt,
  labelBottomPt = 16,
}: {
  paperHeightPt: number
  firstTrimTopPt: number
  lastTrimBottomPt: number
  labelBottomPt?: number
}): number | null {
  const scaleBlockHeight = 20
  const clearance = 6
  const lineOffsetFromBlockTop = 8
  const labelBottom = labelBottomPt + clearance
  const topLineY = labelBottom + lineOffsetFromBlockTop

  if (
    Number.isFinite(paperHeightPt) &&
    Number.isFinite(firstTrimTopPt) &&
    Number.isFinite(labelBottomPt) &&
    firstTrimTopPt >= topLineY + scaleBlockHeight - lineOffsetFromBlockTop + clearance
  ) {
    return topLineY
  }

  const bottomLineY = paperHeightPt - clearance - (scaleBlockHeight - lineOffsetFromBlockTop)
  if (
    Number.isFinite(paperHeightPt) &&
    Number.isFinite(lastTrimBottomPt) &&
    bottomLineY - lineOffsetFromBlockTop >= lastTrimBottomPt + clearance
  ) {
    return bottomLineY
  }

  return null
}
