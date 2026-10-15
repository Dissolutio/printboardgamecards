import { describe, expect, it } from 'vitest'
import { CARD_PRESETS } from './geometry.ts'
import { cropAreaSize, effectiveDpi, isLowRes } from './crop.ts'

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
