import type { Calibration, Grid } from './layout.ts'
import {
  applyCalibration,
  DEFAULT_BLEED,
  type Point,
  type Size,
} from './geometry.ts'

export type CalibrationMm = {
  offsetXmm: number
  offsetYmm: number
}

export type CalibrationDeltaMm = {
  dxMm: number
  dyMm: number
}

export type CalibrationMark = Point & {
  shape: 'circle' | 'square'
}

export type CalibrationMarks = {
  front: CalibrationMark[]
  back: CalibrationMark[]
}

export const CALIBRATION_STORAGE_KEY = 'printboardgamecards.calibration'

const ZERO_CALIBRATION: CalibrationMm = { offsetXmm: 0, offsetYmm: 0 }

function roundHundredth(value: number): number {
  return Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100
}

function clampAxis(value: number): number {
  return Number.isFinite(value) ? Math.min(10, Math.max(-10, value)) : 0
}

function isCalibrationMm(value: unknown): value is CalibrationMm {
  if (typeof value !== 'object' || value === null) return false

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.offsetXmm === 'number' &&
    Number.isFinite(candidate.offsetXmm) &&
    typeof candidate.offsetYmm === 'number' &&
    Number.isFinite(candidate.offsetYmm)
  )
}

export function calibrationFromObserved(
  obsXmm: number,
  obsYmm: number,
): CalibrationDeltaMm {
  return { dxMm: -obsXmm, dyMm: -obsYmm }
}

export function addCalibration(
  current: CalibrationMm,
  delta: CalibrationDeltaMm,
): CalibrationMm {
  return {
    offsetXmm: roundHundredth(current.offsetXmm + delta.dxMm),
    offsetYmm: roundHundredth(current.offsetYmm + delta.dyMm),
  }
}

export function clampCalibration(value: CalibrationMm): CalibrationMm {
  return {
    offsetXmm: clampAxis(value.offsetXmm),
    offsetYmm: clampAxis(value.offsetYmm),
  }
}

export function loadCalibration(): CalibrationMm {
  try {
    const serialized = globalThis.localStorage.getItem(CALIBRATION_STORAGE_KEY)
    if (serialized === null) return { ...ZERO_CALIBRATION }

    const parsed: unknown = JSON.parse(serialized)
    return isCalibrationMm(parsed)
      ? clampCalibration(parsed)
      : { ...ZERO_CALIBRATION }
  } catch {
    return { ...ZERO_CALIBRATION }
  }
}

export function saveCalibration(value: CalibrationMm): boolean {
  try {
    const normalized = clampCalibration(value)
    globalThis.localStorage.setItem(
      CALIBRATION_STORAGE_KEY,
      JSON.stringify(normalized),
    )
    return true
  } catch {
    return false
  }
}

export function calibrationMarks(
  grid: Grid,
  paper: Size,
  calibrationPt: Calibration,
): CalibrationMarks {
  const trimWidth = grid.cellW - 2 * DEFAULT_BLEED
  const trimHeight = grid.cellH - 2 * DEFAULT_BLEED
  const left = grid.originX + DEFAULT_BLEED
  const top = grid.originY + DEFAULT_BLEED
  const right =
    grid.originX +
    (grid.cols - 1) * grid.cellW +
    DEFAULT_BLEED +
    trimWidth
  const bottom =
    grid.originY +
    (grid.rows - 1) * grid.cellH +
    DEFAULT_BLEED +
    trimHeight
  const frontPositions: Point[] = [
    { x: left, y: top },
    { x: right, y: top },
    { x: left, y: bottom },
    { x: right, y: bottom },
  ]

  return {
    front: frontPositions.map((point) => ({ ...point, shape: 'circle' })),
    back: frontPositions.map((point) => ({
      ...applyCalibration(
        { x: paper.width - point.x, y: point.y },
        calibrationPt,
      ).back,
      shape: 'square',
    })),
  }
}
