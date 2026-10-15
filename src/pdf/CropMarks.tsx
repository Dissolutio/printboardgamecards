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
}

function cropMarkRects(
  placement: Placement,
  cardSize: Size,
  bleed: number,
  offset: number,
  length: number,
): CropMark[] {
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
}: CropMarksProps) {
  return (
    <>
      {cropMarkRects(placement, cardSize, bleed, offset, length).map((mark, index) => (
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
