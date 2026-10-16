import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  addCalibration,
  calibrationFromObserved,
  calibrationMarks,
  clampCalibration,
  loadCalibration,
  saveCalibration,
} from './calibration.ts'
import {
  calculateGrid,
  CARD_PRESETS,
  DEFAULT_BLEED,
  mmToPt,
  PAPER,
} from './geometry.ts'

afterEach(() => vi.unstubAllGlobals())

describe('calibration arithmetic', () => {
  it('inverts observed back-mark offsets', () => {
    expect(calibrationFromObserved(1, 0.5)).toEqual({ dxMm: -1, dyMm: -0.5 })
  })

  it('accumulates and rounds corrections to hundredths of a millimetre', () => {
    const delta = calibrationFromObserved(1, 0.5)
    const first = addCalibration({ offsetXmm: 0, offsetYmm: 0 }, delta)
    const second = addCalibration(first, delta)

    expect(first).toEqual({ offsetXmm: -1, offsetYmm: -0.5 })
    expect(second).toEqual({ offsetXmm: -2, offsetYmm: -1 })
    expect(
      addCalibration({ offsetXmm: 0.004, offsetYmm: -0.004 }, {
        dxMm: 0.005,
        dyMm: -0.005,
      }),
    ).toEqual({ offsetXmm: 0.01, offsetYmm: -0.01 })
  })

  it('clamps both axes to ten millimetres in either direction', () => {
    expect(
      clampCalibration({ offsetXmm: 12, offsetYmm: -14 }),
    ).toEqual({ offsetXmm: 10, offsetYmm: -10 })
  })
})

describe('calibration storage', () => {
  it('falls back to zero when no value is stored', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => undefined,
    })
    expect(loadCalibration()).toEqual({ offsetXmm: 0, offsetYmm: 0 })
  })

  it('falls back to zero for missing and corrupt stored values', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => '{not-json',
      setItem: () => undefined,
    })
    expect(loadCalibration()).toEqual({ offsetXmm: 0, offsetYmm: 0 })
  })

  it('falls back to zero when storage reads throw', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('storage unavailable')
      },
      setItem: () => undefined,
    })
    expect(loadCalibration()).toEqual({ offsetXmm: 0, offsetYmm: 0 })
  })

  it('catches unavailable storage writes', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('storage unavailable')
      },
    })
    expect(saveCalibration({ offsetXmm: 1, offsetYmm: -0.5 })).toBe(false)
  })
})

describe('calibrationMarks', () => {
  const paper = PAPER.LETTER
  const grid = calculateGrid({
    paper,
    card: CARD_PRESETS.POKER,
    bleed: DEFAULT_BLEED,
  })

  it('returns four circle and four square marks mirrored at zero offset', () => {
    const marks = calibrationMarks(grid, paper, { offsetX: 0, offsetY: 0 })

    expect(marks.front).toHaveLength(4)
    expect(marks.front.every((mark) => mark.shape === 'circle')).toBe(true)
    expect(marks.back).toHaveLength(4)
    expect(marks.back.every((mark) => mark.shape === 'square')).toBe(true)
    expect(marks.back.map(({ x, y }) => ({ x, y }))).toEqual(
      marks.front.map(({ x, y }) => ({ x: paper.width - x, y })),
    )
  })

  it('applies calibration only to the mirrored back marks', () => {
    const zero = calibrationMarks(grid, paper, { offsetX: 0, offsetY: 0 })
    const shifted = calibrationMarks(grid, paper, {
      offsetX: mmToPt(1),
      offsetY: mmToPt(0.5),
    })

    expect(shifted.front).toEqual(zero.front)
    expect(shifted.back[0].x - zero.back[0].x).toBeCloseTo(-2.83, 2)
    expect(shifted.back[0].y - zero.back[0].y).toBeCloseTo(1.42, 2)
  })
})
