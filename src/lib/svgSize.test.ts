import { describe, expect, it } from 'vitest'
import { centeredMaximumCrop } from './cropConvert.ts'
import { svgIntrinsicSize } from './svgSize.ts'

describe('svgIntrinsicSize', () => {
  it('reads positive viewBox dimensions with common attribute formats', () => {
    expect(svgIntrinsicSize('<svg viewBox="0 0 223 324"></svg>')).toEqual({
      width: 223,
      height: 324,
    })
    expect(svgIntrinsicSize("<svg role='img' viewBox='-2,-3, 10,20'></svg>")).toEqual({
      width: 10,
      height: 20,
    })
  })

  it.each([
    '<svg></svg>',
    '<svg viewBox="0 0 10"></svg>',
    '<svg viewBox="0 0 10 0"></svg>',
    '<svg viewBox="0 0 NaN 10"></svg>',
    '<div viewBox="0 0 10 20"></div>',
  ])('rejects SVG text without usable viewBox dimensions', (svgText) => {
    expect(svgIntrinsicSize(svgText)).toBeUndefined()
  })

  it('keeps crop geometry finite for very large viewBox dimensions', () => {
    const size = svgIntrinsicSize('<svg viewBox="0 0 1000000000 1500000000"></svg>')
    expect(size).toEqual({ width: 1_000_000_000, height: 1_500_000_000 })
    if (!size) return

    const crop = centeredMaximumCrop(size, { width: 225, height: 315 })
    expect(Object.values(crop).every(Number.isFinite)).toBe(true)
    expect(crop.width).toBeGreaterThan(0)
    expect(crop.height).toBeGreaterThan(0)
  })
})
