import { Image, View } from '@react-pdf/renderer'
import { DEFAULT_BLEED } from '../lib/geometry.ts'
import { pieceFills } from '../lib/piece.ts'
import type { Placement } from '../lib/layout.ts'
import type { BleedMode, Card, CardSide } from '../types.ts'
import type { Size } from '../lib/geometry.ts'

type CardPieceProps = {
  card: Card
  placement: Placement
  cardSize: Size
  bleedMode: BleedMode
  side: CardSide
}

export default function CardPiece({
  card,
  placement,
  cardSize,
  bleedMode,
  side,
}: CardPieceProps) {
  const source = side === 'front' ? card.frontProcessedSrc : card.backProcessedSrc
  const hasExplicitBackground =
    side === 'front' ? card.frontBackgroundColor !== undefined : card.backBackgroundColor !== undefined
  if (!source && !hasExplicitBackground) return null

  const fills = pieceFills({ ...card, bleedMode }, side)
  const imageInset = bleedMode === 'COLOR' ? DEFAULT_BLEED : 0
  const imageWidth = bleedMode === 'COLOR' ? cardSize.width : placement.width
  const imageHeight = bleedMode === 'COLOR' ? cardSize.height : placement.height

  return (
    <>
      {fills.map((fill, index) => {
        const inset = fill.rect === 'trim' ? DEFAULT_BLEED : 0
        const width = fill.rect === 'trim' ? cardSize.width : placement.width
        const height = fill.rect === 'trim' ? cardSize.height : placement.height

        return (
          <View
            key={`fill-${index}`}
            style={{
              position: 'absolute',
              left: placement.x + inset,
              top: placement.y + inset,
              width,
              height,
              backgroundColor: fill.color,
            }}
          />
        )
      })}
      {source && (
        <Image
          src={source}
          style={{
            position: 'absolute',
            left: placement.x + imageInset,
            top: placement.y + imageInset,
            width: imageWidth,
            height: imageHeight,
          }}
        />
      )}
    </>
  )
}
