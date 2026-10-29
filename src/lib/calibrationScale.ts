import type { Point, Size } from './geometry.ts'

export const SHEET_WIDTH_MM = {
  LETTER: 215.9,
  A4: 210,
} as const

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

function labelIndex(mm: number): number {
  return mm < 0 ? 5 + mm : mm + 4
}

export function cornerLabelBoxes(
  mark: Point,
  paper: Size,
): CornerLabelBox[] {
  const isLeft = mark.x < paper.width / 2
  const isTop = mark.y < paper.height / 2
  const ticks = cornerScaleTicks().filter((tick) => tick.label !== undefined)
  const width = 7
  const height = 5

  return ticks.flatMap((tick) => {
    const offsetPt = tick.offsetPt ?? 0
    const index = labelIndex(tick.mm)
    const rowOffset = 8 + (index % 3) * 6
    const innerOffset = 22 + (index % 3) * 8

    return [
      {
        axis: 'horizontal' as const,
        text: tick.label ?? '',
        left: mark.x + offsetPt - width / 2 + Math.sign(tick.mm) * 2,
        top: isTop ? mark.y + rowOffset : mark.y - rowOffset - height,
        width,
        height,
      },
      {
        axis: 'vertical' as const,
        text: tick.label ?? '',
        left: isLeft ? mark.x + innerOffset : mark.x - innerOffset - width,
        top: mark.y + offsetPt - height / 2,
        width,
        height,
      },
    ]
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
}: {
  paperHeightPt: number
  firstTrimTopPt: number
  lastTrimBottomPt: number
}): number | null {
  const edgeClearance = 17
  const trimClearance = 6
  const tickHalfHeight = 4
  const labelBottomOffset = 11
  const topLineY = 30

  if (
    Number.isFinite(paperHeightPt) &&
    Number.isFinite(firstTrimTopPt) &&
    topLineY - tickHalfHeight >= edgeClearance &&
    topLineY + labelBottomOffset + trimClearance <= firstTrimTopPt
  ) {
    return topLineY
  }

  const bottomLineY = paperHeightPt - edgeClearance - labelBottomOffset
  if (
    Number.isFinite(paperHeightPt) &&
    Number.isFinite(lastTrimBottomPt) &&
    bottomLineY - tickHalfHeight >= lastTrimBottomPt + trimClearance
  ) {
    return bottomLineY
  }

  return null
}
