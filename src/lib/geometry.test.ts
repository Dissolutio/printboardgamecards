import { describe, expect, it } from 'vitest'
import {
  applyCalibration,
  calculateGrid,
  CARD_PRESETS,
  mirrorPageBacks,
  mmToPt,
  PAPER,
} from './geometry.ts'

describe('calculateGrid', () => {
  it('fits Poker cards on Letter paper in a 2 by 2 grid with an 18 point margin', () => {
    const grid = calculateGrid({
      paper: PAPER.LETTER,
      card: CARD_PRESETS.POKER,
      margin: 18,
    })

    expect(grid.cols).toBe(2)
    expect(grid.rows).toBe(2)
  })

  it('fits Mini cards on Letter paper in a 4 by 3 grid with an 18 point margin', () => {
    const grid = calculateGrid({
      paper: PAPER.LETTER,
      card: CARD_PRESETS.MINI,
      margin: 18,
    })

    expect(grid.cols).toBe(4)
    expect(grid.rows).toBe(3)
  })

  it('fits Mini cards on Letter paper in a 3 by 3 grid with a 36 point margin', () => {
    const grid = calculateGrid({
      paper: PAPER.LETTER,
      card: CARD_PRESETS.MINI,
      margin: 36,
    })

    expect(grid.cols).toBe(3)
    expect(grid.rows).toBe(3)
  })

  it('centers the grid horizontally on the page', () => {
    const grid = calculateGrid({
      paper: PAPER.LETTER,
      card: CARD_PRESETS.MINI,
      margin: 18,
    })

    expect(grid.originX).toBe(18)
    expect(grid.originX).toBe((PAPER.LETTER.width - grid.gridW) / 2)
  })
})

describe('mirrorPageBacks', () => {
  it('reverses each row chunk', () => {
    expect(mirrorPageBacks([0, 1, 2, 3, 4, 5], 2)).toEqual([1, 0, 3, 2, 5, 4])
  })
})

describe('applyCalibration', () => {
  it('keeps the front fixed and moves the back opposite the horizontal offset', () => {
    const origin = { x: 10, y: 20 }
    const calibration = { offsetX: mmToPt(1), offsetY: 0 }
    const result = applyCalibration(origin, calibration)

    expect(result.front).toBe(origin)
    expect(result.front).toEqual({ x: 10, y: 20 })
    expect(result.back.x).toBeCloseTo(origin.x - 2.83, 2)
    expect(result.back.y).toBe(origin.y)
  })
})

describe('mmToPt', () => {
  it('converts millimeters to points', () => {
    expect(mmToPt(1)).toBeCloseTo(2.83, 2)
  })
})
