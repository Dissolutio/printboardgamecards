import { describe, expect, it } from 'vitest'
import { intersectCrop } from './intersectCrop.ts'

describe('intersectCrop', () => {
  const imageSize = { width: 200, height: 120 }

  it('returns matching source and destination rectangles for an inside crop', () => {
    const crop = { x: 20, y: 10, width: 80, height: 60 }

    expect(intersectCrop(crop, imageSize)).toEqual({
      source: crop,
      destination: { x: 0, y: 0, width: crop.width, height: crop.height },
    })
  })

  it('offsets the destination when a crop partly leaves the image', () => {
    expect(
      intersectCrop({ x: -20, y: 90, width: 100, height: 60 }, imageSize),
    ).toEqual({
      source: { x: 0, y: 90, width: 80, height: 30 },
      destination: { x: 20, y: 0, width: 80, height: 30 },
    })
  })

  it('returns no intersection when the crop is fully outside the image', () => {
    expect(
      intersectCrop({ x: -120, y: 140, width: 50, height: 40 }, imageSize),
    ).toBeUndefined()
  })
})
