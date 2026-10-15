import { describe, expect, it } from 'vitest'
import { convertCropForBleedMode } from './cropConvert.ts'
import { CARD_PRESETS, DEFAULT_BLEED } from './geometry.ts'

const trimSize = CARD_PRESETS.POKER

describe('convertCropForBleedMode', () => {
  it.each([
    ['inside', { x: 80, y: 60, width: 1320, height: 1800 }],
    ['extending outside the image', { x: -120, y: -60, width: 1320, height: 1800 }],
  ])('round trips an IMAGE crop %s through COLOR', (_description, source) => {
    const imageSize = { width: 1800, height: 2400 }

    const colorCrop = convertCropForBleedMode(
      source,
      imageSize,
      trimSize,
      DEFAULT_BLEED,
      'IMAGE',
      'COLOR',
    )
    const restored = convertCropForBleedMode(
      colorCrop,
      imageSize,
      trimSize,
      DEFAULT_BLEED,
      'COLOR',
      'IMAGE',
    )

    expect(restored.x).toBeCloseTo(source.x, 8)
    expect(restored.y).toBeCloseTo(source.y, 8)
    expect(restored.width).toBeCloseTo(source.width, 8)
    expect(restored.height).toBeCloseTo(source.height, 8)
  })

  it('does not clamp an expanded crop to the image bounds', () => {
    const imageSize = { width: 500, height: 700 }
    const source = { x: 15, y: 15, width: 470, height: 658 }
    const result = convertCropForBleedMode(
      source,
      imageSize,
      trimSize,
      DEFAULT_BLEED,
      'COLOR',
      'IMAGE',
    )

    expect(result.x).toBeLessThan(0)
    expect(result.y).toBeLessThan(0)
    expect(result.x + result.width).toBeGreaterThan(imageSize.width)
  })

  it('matches the target area aspect within half a pixel', () => {
    const imageSize = { width: 500, height: 700 }
    const result = convertCropForBleedMode(
      { x: 10, y: 10, width: 480, height: 672 },
      imageSize,
      trimSize,
      DEFAULT_BLEED,
      'COLOR',
      'IMAGE',
    )
    const targetAspect =
      (trimSize.width + 2 * DEFAULT_BLEED) /
      (trimSize.height + 2 * DEFAULT_BLEED)

    expect(Math.abs(result.width - result.height * targetAspect)).toBeLessThanOrEqual(0.5)
  })
})
