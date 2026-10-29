import type { CardSide } from '../types.ts'

type FaceLabelOptions = {
  side: CardSide
  hasImage: boolean
  hasBackground: boolean
}

export function emptyFaceLabel({
  side,
  hasImage,
  hasBackground,
}: FaceLabelOptions): string | undefined {
  if (hasImage || hasBackground) return undefined
  return side === 'front' ? 'No front image' : 'No back image'
}

export function accessibleFaceName({
  side,
  hasImage,
  hasBackground,
}: FaceLabelOptions): string | undefined {
  if (hasImage || !hasBackground) return undefined
  return side === 'front'
    ? 'Front side: background color, no image.'
    : 'Back side: background color, no image.'
}
