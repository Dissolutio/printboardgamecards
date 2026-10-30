import CardFace from './CardFace.tsx'
import QuantityStepper from './QuantityStepper.tsx'
import { hasBackground } from '../lib/piece.ts'
import type { Size } from '../lib/geometry.ts'
import type { Card, CardSide } from '../types.ts'

const SIDES: CardSide[] = ['front', 'back']
type QuantityDirection = -1 | 1

type CardListProps = {
  cards: Card[]
  selectedId: string
  cardSize: Size
  disabled: boolean
  onAdd: () => void
  onSelect: (cardId: string) => void
  onQuantityStep: (cardId: string, direction: QuantityDirection) => void
  onDuplicate: (cardId: string) => void
  onDelete: (cardId: string) => void
}

export default function CardList({
  cards,
  selectedId,
  cardSize,
  disabled,
  onAdd,
  onSelect,
  onQuantityStep,
  onDuplicate,
  onDelete,
}: CardListProps) {
  return (
    <section className="mb-6 rounded-box border border-base-300 bg-base-100 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Cards</h2>
        <button
          className="btn btn-outline btn-primary"
          type="button"
          disabled={disabled}
          onClick={onAdd}
        >
          + Add card
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, index) => (
          <article
            key={card.id}
            className={`rounded-box border p-3 ${card.id === selectedId ? 'border-primary' : 'border-base-300'}`}
          >
            <button
              className="flex w-full items-center gap-3 text-left"
              type="button"
              aria-pressed={card.id === selectedId}
              disabled={disabled}
              onClick={() => onSelect(card.id)}
            >
              <span className="grid w-28 shrink-0 grid-cols-2 gap-1">
                {SIDES.map((side) => (
                  <CardFace
                    key={side}
                    card={card}
                    side={side}
                    cardSize={cardSize}
                    showBleedRing={card.bleedMode === 'COLOR'}
                    source={side === 'front' ? card.frontProcessedSrc : card.backProcessedSrc}
                    alt={`Card ${index + 1} ${side} thumbnail`}
                  />
                ))}
              </span>
              <span className="min-w-0">
                <span className="block font-medium">Card {index + 1}</span>
              </span>
            </button>
            <div className="mt-2 flex justify-end">
              <QuantityStepper
                quantity={card.quantity}
                cardLabel={`Card ${index + 1}`}
                disabled={disabled}
                onStep={(direction) => onQuantityStep(card.id, direction)}
              />
            </div>
            {!card.frontSrc ? (
              <p className="mt-2 text-sm text-warning">
                This card has no front image. It will be skipped during export.
              </p>
            ) : (!card.frontProcessedSrc || !card.frontCrop) && (
              <p className="mt-2 text-sm text-warning">
                Front crop required; this card will be skipped during export.
              </p>
            )}
            {!card.backSrc && !hasBackground(card, 'back') && (
              <p className="mt-2 text-sm text-warning">
                This card has no back image and no back background. No back will be printed.
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                className="btn btn-sm btn-outline flex-1"
                type="button"
                disabled={disabled}
                onClick={() => onDuplicate(card.id)}
              >
                Duplicate
              </button>
              <button
                className="btn btn-sm btn-outline btn-error flex-1"
                type="button"
                disabled={disabled}
                onClick={() => onDelete(card.id)}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
