import type { Size } from './geometry.ts'
import type { BleedMode, PixelCropRect } from '../types.ts'

function areaWidthPt(trimSize: Size, bleed: number, mode: BleedMode): number {
  return trimSize.width + (mode === 'IMAGE' ? 2 * bleed : 0)
}

export function centeredMaximumCrop(imageSize: Size, areaSize: Size): PixelCropRect {
  const scale = Math.min(
    imageSize.width / areaSize.width,
    imageSize.height / areaSize.height,
  )
  const width = areaSize.width * scale
  const height = areaSize.height * scale

  return {
    x: (imageSize.width - width) / 2,
    y: (imageSize.height - height) / 2,
    width,
    height,
  }
}

export function convertCropForBleedMode(
  crop: PixelCropRect,
  imageSize: Size,
  trimSize: Size,
  bleed: number,
  from: BleedMode,
  to: BleedMode,
): PixelCropRect {
  if (!(imageSize.width > 0) || !(imageSize.height > 0)) {
    throw new RangeError('Image dimensions must be positive.')
  }

  const sourceWidthPt = areaWidthPt(trimSize, bleed, from)
  const scale = crop.width / sourceWidthPt
  const delta =
    from === to ? 0 : bleed * scale * (from === 'IMAGE' ? 1 : -1)

  const x = crop.x + delta
  const y = crop.y + delta
  const width = crop.width - 2 * delta
  const height = crop.height - 2 * delta

  if (!(width > 0) || !(height > 0)) {
    throw new RangeError('Crop must have a positive area.')
  }

  return { x, y, width, height }
}
