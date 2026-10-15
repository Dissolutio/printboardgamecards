import { Image, View } from '@react-pdf/renderer'
import { DEFAULT_BLEED } from '../lib/geometry.ts'
import { hasBackground, pieceFills } from '../lib/piece.ts'
import type { Placement } from '../lib/layout.ts'
import type { Card, CardSide } from '../types.ts'
import type { Size } from '../lib/geometry.ts'

type CardPieceProps = {
  card: Card
  placement: Placement
  cardSize: Size
  side: CardSide
  paintedBleed?: number
  clipToPaintedRect?: boolean
}

export default function CardPiece({
  card,
  placement,
  cardSize,
  side,
  paintedBleed = DEFAULT_BLEED,
  clipToPaintedRect = false,
}: CardPieceProps) {
  const bleedMode = card.bleedMode
  const source = side === 'front' ? card.frontProcessedSrc : card.backProcessedSrc
  if (!source && !hasBackground(card, side)) return null

  const fills = pieceFills(card, side)
  const imageInset = bleedMode === 'COLOR' ? DEFAULT_BLEED : 0
  const artworkInset = bleedMode === 'IMAGE' ? DEFAULT_BLEED : 0
  const imageWidth = bleedMode === 'COLOR' ? cardSize.width : placement.width
  const imageHeight = bleedMode === 'COLOR' ? cardSize.height : placement.height
  const fullArtworkWidth =
    bleedMode === 'COLOR' ? cardSize.width : cardSize.width + 2 * DEFAULT_BLEED
  const fullArtworkHeight =
    bleedMode === 'COLOR' ? cardSize.height : cardSize.height + 2 * DEFAULT_BLEED

  if (clipToPaintedRect) {
    return (
      <View
        style={{
          position: 'absolute',
          left: placement.x,
          top: placement.y,
          width: placement.width,
          height: placement.height,
          overflow: 'hidden',
        }}
      >
        {fills.map((fill, index) => {
          const inset = fill.rect === 'trim' ? paintedBleed : 0
          const width = fill.rect === 'trim' ? cardSize.width : placement.width
          const height = fill.rect === 'trim' ? cardSize.height : placement.height

          return (
            <View
              key={`fill-${index}`}
              style={{
                position: 'absolute',
                left: inset,
                top: inset,
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
              left: paintedBleed - artworkInset,
              top: paintedBleed - artworkInset,
              width: fullArtworkWidth,
              height: fullArtworkHeight,
            }}
          />
        )}
      </View>
    )
  }

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
