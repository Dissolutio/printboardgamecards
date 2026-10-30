import CardFace from './CardFace.tsx'
import QuantityStepper from './QuantityStepper.tsx'
import type { Size } from '../lib/geometry.ts'
import type { Card, CardSide } from '../types.ts'

const SIDES: CardSide[] = ['front', 'back']
type QuantityDirection = -1 | 1

type PrintPreviewProps = {
  cards: Card[]
  cardSize: Size
  disabled: boolean
  onQuantityStep: (cardId: string, direction: QuantityDirection) => void
}

export default function PrintPreview({
  cards,
  cardSize,
  disabled,
  onQuantityStep,
}: PrintPreviewProps) {
  return (
    <section className="rounded-box border border-base-300 bg-base-100 p-5">
      <h2 className="mb-4 text-lg font-semibold">Print preview</h2>
      {cards.length === 0 ? (
        <p className="text-sm text-base-content/60">No cards in this deck.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, index) => (
            <article key={card.id} className="rounded-box border border-base-300 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium">Card {index + 1}</h3>
                <QuantityStepper
                  quantity={card.quantity}
                  cardLabel={`Card ${index + 1}`}
                  disabled={disabled}
                  onStep={(direction) => onQuantityStep(card.id, direction)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SIDES.map((side) => {
                  const source =
                    side === 'front' ? card.frontProcessedSrc : card.backProcessedSrc
                  return (
                    <div key={side}>
                      <p className="mb-1 text-xs capitalize text-base-content/60">{side}</p>
                      <CardFace
                        card={card}
                        side={side}
                        cardSize={cardSize}
                        showBleedRing={card.bleedMode === 'COLOR'}
                        source={source}
                        placeholder={
                          side === 'front' && card.frontSrc && !card.frontProcessedSrc
                            ? 'Crop required'
                            : undefined
                        }
                        alt={`Card ${index + 1} ${side} print preview`}
                      />
                    </div>
                  )
                })}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
