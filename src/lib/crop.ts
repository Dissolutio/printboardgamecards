import type { Size } from './geometry.ts'
import type { BleedMode } from '../types.ts'

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
