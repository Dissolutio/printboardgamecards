import type { Size } from './geometry.ts'
import type { PixelCropRect } from '../types.ts'

export type CropIntersection = {
  source: PixelCropRect
  destination: PixelCropRect
}

export function intersectCrop(
  crop: PixelCropRect,
  imageSize: Size,
): CropIntersection | undefined {
  const sourceX = Math.max(crop.x, 0)
  const sourceY = Math.max(crop.y, 0)
  const sourceRight = Math.min(crop.x + crop.width, imageSize.width)
  const sourceBottom = Math.min(crop.y + crop.height, imageSize.height)
  const width = sourceRight - sourceX
  const height = sourceBottom - sourceY

  if (width <= 0 || height <= 0) return undefined

  return {
    source: { x: sourceX, y: sourceY, width, height },
    destination: {
      x: sourceX - crop.x,
      y: sourceY - crop.y,
      width,
      height,
    },
  }
}
