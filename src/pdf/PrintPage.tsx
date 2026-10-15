import CardPiece from './CardPiece.tsx'
import CropMarks from './CropMarks.tsx'
import type { Size } from '../lib/geometry.ts'
import type { Placement } from '../lib/layout.ts'
import type { BleedMode, Card, CardSide } from '../types.ts'

type PrintPageProps = {
  placements: Placement[]
  cards: Card[]
  cardSize: Size
  bleedMode: BleedMode
  side: CardSide
  drawCropMarks: boolean
}

export default function PrintPage({
  placements,
  cards,
  cardSize,
  bleedMode,
  side,
  drawCropMarks,
}: PrintPageProps) {
  const cardsById = new Map(cards.map((card) => [card.id, card]))

  return (
    <>
      {placements.map((placement, index) => {
        const card = cardsById.get(placement.cardId)
        if (!card) return null

        return (
          <CardPiece
            key={`piece-${index}`}
            card={card}
            placement={placement}
            cardSize={cardSize}
            bleedMode={bleedMode}
            side={side}
          />
        )
      })}
      {drawCropMarks &&
        placements.map((placement, index) => (
          <CropMarks
            key={`crop-marks-${index}`}
            placement={placement}
            cardSize={cardSize}
          />
        ))}
    </>
  )
}
