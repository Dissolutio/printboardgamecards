import type { Size } from './geometry.ts'
import type { BleedMode, PixelCropRect } from '../types.ts'

export function sameCropRect(
  left: PixelCropRect | undefined,
  right: PixelCropRect,
): boolean {
  return (
    left !== undefined &&
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  )
}

export function cropAreaSize(
  card: Size,
  bleed: number,
  bleedMode: BleedMode,
): Size {
  const bleedAmount = bleedMode === 'IMAGE' ? 2 * bleed : 0

  return {
    width: card.width + bleedAmount,
    height: card.height + bleedAmount,
  }
}

export function effectiveDpi(cropPixelWidth: number, areaWidthPt: number): number {
  return cropPixelWidth / (areaWidthPt / 72)
}

export function isLowRes(dpi: number): boolean {
  return dpi < 200
}
