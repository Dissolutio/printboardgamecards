import { Fragment } from 'react'
import { Image, View } from '@react-pdf/renderer'
import { DEFAULT_BLEED } from '../lib/geometry.ts'
import type { Placement } from '../lib/layout.ts'
import type { Card } from '../types.ts'

type PrintPageProps = {
  placements: Placement[]
  cards: Card[]
  side: 'front' | 'back'
  drawCropMarks: boolean
}

type CropMark = {
  left: number
  top: number
  width: number
  height: number
}

function cropMarks(placement: Placement, card: Card): CropMark[] {
  const trimLeft = placement.x + DEFAULT_BLEED
  const trimTop = placement.y + DEFAULT_BLEED
  const trimRight = trimLeft + card.width
  const trimBottom = trimTop + card.height
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

export default function PrintPage({
  placements,
  cards,
  side,
  drawCropMarks,
}: PrintPageProps) {
  const cardsById = new Map(cards.map((card) => [card.id, card]))

  return (
    <>
      {placements.flatMap((placement, placementIndex) => {
        const card = cardsById.get(placement.cardId)
        const source = side === 'front' ? card?.frontSrc : card?.backSrc
        if (!card || !source) return []

        const isImageBleed = card.bleedMode === 'IMAGE'
        const imageLeft = isImageBleed ? placement.x : placement.x + DEFAULT_BLEED
        const imageTop = isImageBleed ? placement.y : placement.y + DEFAULT_BLEED
        const imageWidth = isImageBleed ? placement.width : card.width
        const imageHeight = isImageBleed ? placement.height : card.height

        return (
          <Fragment key={`card-${placementIndex}`}>
            {!isImageBleed && (
              <View
                style={{
                  position: 'absolute',
                  left: placement.x,
                  top: placement.y,
                  width: placement.width,
                  height: placement.height,
                  backgroundColor: card.bleedColor,
                }}
              />
            )}
            <Image
              src={source}
              style={{
                position: 'absolute',
                left: imageLeft,
                top: imageTop,
                width: imageWidth,
                height: imageHeight,
              }}
            />
          </Fragment>
        )
      })}
      {drawCropMarks &&
        placements.flatMap((placement, placementIndex) => {
          const card = cardsById.get(placement.cardId)
          if (!card) return []

          return cropMarks(placement, card).map((mark, markIndex) => (
            <View
              key={`mark-${placementIndex}-${markIndex}`}
              style={{
                position: 'absolute',
                left: mark.left,
                top: mark.top,
                width: mark.width,
                height: mark.height,
                backgroundColor: '#000000',
              }}
            />
          ))
        })}
    </>
  )
}
