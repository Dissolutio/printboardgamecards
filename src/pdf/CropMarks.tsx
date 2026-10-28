import { View } from '@react-pdf/renderer'
import { DEFAULT_BLEED } from '../lib/geometry.ts'
import type { Placement } from '../lib/layout.ts'
import type { Size } from '../lib/geometry.ts'

type CropMark = {
  left: number
  top: number
  width: number
  height: number
}

type CropMarksProps = {
  placement: Placement
  cardSize: Size
  bleed?: number
  offset?: number
  length?: number
  rotated?: boolean
}

function cropMarkRects(
  placement: Placement,
  cardSize: Size,
  bleed: number,
  offset: number,
  length: number,
  rotated: boolean,
): CropMark[] {
  if (rotated) {
    const uprightPlacement = {
      ...placement,
      x: placement.x + (placement.width - placement.height) / 2,
      y: placement.y + (placement.height - placement.width) / 2,
      width: placement.height,
      height: placement.width,
    }
    const centerX = uprightPlacement.x + bleed + cardSize.width / 2
    const centerY = uprightPlacement.y + bleed + cardSize.height / 2

    return cropMarkRects(
      uprightPlacement,
      cardSize,
      bleed,
      offset,
      length,
      false,
    ).map((mark) => {
      const markCenterX = mark.left + mark.width / 2
      const markCenterY = mark.top + mark.height / 2
      const rotatedCenterX = centerX - (markCenterY - centerY)
      const rotatedCenterY = centerY + (markCenterX - centerX)

      return {
        left: rotatedCenterX - mark.height / 2,
        top: rotatedCenterY - mark.width / 2,
        width: mark.height,
        height: mark.width,
      }
    })
  }

  const trimLeft = placement.x + bleed
  const trimTop = placement.y + bleed
  const trimRight = trimLeft + cardSize.width
  const trimBottom = trimTop + cardSize.height
  const thickness = 0.5

  return [
    { left: trimLeft - offset - length, top: trimTop - offset - thickness / 2, width: length, height: thickness },
    { left: trimLeft - offset - thickness / 2, top: trimTop - offset - length, width: thickness, height: length },
    { left: trimRight + offset, top: trimTop - offset - thickness / 2, width: length, height: thickness },
    { left: trimRight + offset + thickness / 2, top: trimTop - offset - length, width: thickness, height: length },
    { left: trimLeft - offset - length, top: trimBottom + offset, width: length, height: thickness },
    { left: trimLeft - offset - thickness / 2, top: trimBottom + offset, width: thickness, height: length },
    { left: trimRight + offset, top: trimBottom + offset, width: length, height: thickness },
    { left: trimRight + offset + thickness / 2, top: trimBottom + offset, width: thickness, height: length },
  ]
}

export default function CropMarks({
  placement,
  cardSize,
  bleed = DEFAULT_BLEED,
  offset = 1,
  length = 6,
  rotated = false,
}: CropMarksProps) {
  return (
    <>
      {cropMarkRects(placement, cardSize, bleed, offset, length, rotated).map((mark, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            left: mark.left,
            top: mark.top,
            width: mark.width,
            height: mark.height,
            backgroundColor: '#000000',
          }}
        />
      ))}
    </>
  )
}
