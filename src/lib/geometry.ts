export type Size = {
  width: number
  height: number
}

export type Point = {
  x: number
  y: number
}

export const PAPER = {
  LETTER: { width: 612, height: 792 },
  A4: { width: 595, height: 842 },
} as const

export const CARD_PRESETS = {
  POKER: { width: 180, height: 252 },
  BRIDGE: { width: 162, height: 252 },
  MINI: { width: 126, height: 180 },
  TAROT: { width: 198, height: 342 },
} as const

export const DEFAULT_BLEED = 9

export function mmToPt(mm: number): number {
  return (mm * 72) / 25.4
}

export function calculateGrid({
  paper,
  card,
  bleed = DEFAULT_BLEED,
  margin = 18,
}: {
  paper: Size
  card: Size
  bleed?: number
  margin?: number
}): {
  cols: number
  rows: number
  cellW: number
  cellH: number
  gridW: number
  gridH: number
  originX: number
  originY: number
} {
  const cellW = card.width + 2 * bleed
  const cellH = card.height + 2 * bleed
  const cols = Math.floor((paper.width - 2 * margin) / cellW)
  const rows = Math.floor((paper.height - 2 * margin) / cellH)
  const gridW = cols * cellW
  const gridH = rows * cellH

  return {
    cols,
    rows,
    cellW,
    cellH,
    gridW,
    gridH,
    originX: (paper.width - gridW) / 2,
    originY: (paper.height - gridH) / 2,
  }
}

export function mirrorPageBacks<T>(items: T[], cols: number): T[] {
  const mirrored = []

  for (let start = 0; start < items.length; start += cols) {
    mirrored.push(...items.slice(start, start + cols).reverse())
  }

  return mirrored
}

export function applyCalibration(
  origin: Point,
  { offsetX, offsetY }: { offsetX: number; offsetY: number },
): { front: Point; back: Point } {
  return {
    front: origin,
    back: { x: origin.x - offsetX, y: origin.y + offsetY },
  }
}
