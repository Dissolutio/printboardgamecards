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
}

function cropMarkRects(placement: Placement, cardSize: Size): CropMark[] {
  const trimLeft = placement.x + DEFAULT_BLEED
  const trimTop = placement.y + DEFAULT_BLEED
  const trimRight = trimLeft + cardSize.width
  const trimBottom = trimTop + cardSize.height
  const gap = 1
  const length = 6
  const thickness = 0.5

  return [
    { left: trimLeft - gap - length, top: trimTop - gap - thickness / 2, width: length, height: thickness },
    { left: trimLeft - gap - thickness / 2, top: trimTop - gap - length, width: thickness, height: length },
    { left: trimRight + gap, top: trimTop - gap - thickness / 2, width: length, height: thickness },
    { left: trimRight + gap + thickness / 2, top: trimTop - gap - length, width: thickness, height: length },
    { left: trimLeft - gap - length, top: trimBottom + gap, width: length, height: thickness },
    { left: trimLeft - gap - thickness / 2, top: trimBottom + gap, width: thickness, height: length },
    { left: trimRight + gap, top: trimBottom + gap, width: length, height: thickness },
    { left: trimRight + gap + thickness / 2, top: trimBottom + gap, width: thickness, height: length },
  ]
}

export default function CropMarks({ placement, cardSize }: CropMarksProps) {
  return (
    <>
      {cropMarkRects(placement, cardSize).map((mark, index) => (
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
