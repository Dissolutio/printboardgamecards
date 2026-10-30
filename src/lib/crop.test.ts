import { describe, expect, it } from 'vitest'
import { CARD_PRESETS } from './geometry.ts'
import { cropAreaSize, effectiveDpi, isLowRes, sameCropRect } from './crop.ts'

describe('cropAreaSize', () => {
  it('includes bleed in IMAGE mode', () => {
    expect(cropAreaSize(CARD_PRESETS.POKER, 9, 'IMAGE')).toEqual({
      width: 198,
      height: 270,
    })
  })

  it('uses trim dimensions in COLOR mode', () => {
    expect(cropAreaSize(CARD_PRESETS.POKER, 9, 'COLOR')).toEqual({
      width: 180,
      height: 252,
    })
  })
})

describe('sameCropRect', () => {
  const crop = { x: 1, y: 2, width: 3, height: 4 }

  it('matches equal crop coordinates', () => {
    expect(sameCropRect(crop, { ...crop })).toBe(true)
  })

  it('rejects missing or changed crop coordinates', () => {
    expect(sameCropRect(undefined, crop)).toBe(false)
    expect(sameCropRect({ ...crop, x: 0 }, crop)).toBe(false)
  })
})

describe('effectiveDpi', () => {
  it('calculates the crop resolution in DPI', () => {
    expect(effectiveDpi(750, 180)).toBe(300)
  })
})

describe('isLowRes', () => {
  it('flags resolution below 200 DPI', () => {
    expect(isLowRes(199.99)).toBe(true)
    expect(isLowRes(200)).toBe(false)
  })
})
