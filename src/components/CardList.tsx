import CardFace from './CardFace.tsx'
import QuantityStepper from './QuantityStepper.tsx'
import { totalCopies } from '../lib/deck.ts'
import { cardCollectionLabel } from '../lib/printSummaryLabels.ts'
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
  onChangeEveryBack: () => void
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
  onChangeEveryBack,
}: CardListProps) {
  const selectedCard = cards.find((card) => card.id === selectedId)
  const selectedIndex = cards.findIndex((card) => card.id === selectedId)
  const locale = new Intl.NumberFormat().resolvedOptions().locale
  const countLabel = cardCollectionLabel(cards.length, totalCopies(cards), locale)
  const selectedHasBack = Boolean(
    selectedCard &&
      (selectedCard.backSrc || selectedCard.backProcessedSrc || hasBackground(selectedCard, 'back')),
  )

  return (
    <section className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="m-0 text-xl font-semibold">Cards</h2>
        <span className="text-sm text-base-content/70">{countLabel}</span>
        <span className="flex-1" />
        <button
          className="btn btn-outline min-h-11"
          type="button"
          disabled={disabled || !selectedHasBack}
          onClick={onChangeEveryBack}
        >
          Change every back
        </button>
        <button
          className="btn btn-outline min-h-11"
          type="button"
          disabled={disabled}
          onClick={onAdd}
        >
          Add card
        </button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-3">
        {cards.map((card, index) => (
          <button
            key={card.id}
            className={`relative flex min-w-0 flex-col items-center gap-1.5 rounded-[10px] border-2 bg-base-100 px-1.5 py-2 text-center ${
              card.id === selectedId ? 'border-secondary' : 'border-base-300'
            }`}
            type="button"
            aria-pressed={card.id === selectedId}
            disabled={disabled}
            onClick={() => onSelect(card.id)}
          >
            {card.quantity > 1 && (
              <span
                aria-label={`${card.quantity} copies`}
                className="absolute right-1 top-1 rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-content"
              >
                {card.quantity}
              </span>
            )}
            <span className="flex items-center gap-[3px]">
              {SIDES.map((side) => (
                <CardFace
                  key={side}
                  card={card}
                  side={side}
                  cardSize={cardSize}
                  showBleedRing={card.bleedMode === 'COLOR'}
                  source={side === 'front' ? card.frontProcessedSrc : card.backProcessedSrc}
                  alt={`Card ${index + 1} ${side} thumbnail`}
                  className="w-[34px] rounded-[3px] bg-[#f6f4ee]"
                />
              ))}
            </span>
            <span className="text-xs text-base-content/70">Card {index + 1}</span>
          </button>
        ))}
      </div>

      {selectedCard && !selectedCard.frontSrc && (
        <p className="mt-3 text-sm text-warning">
          This card has no front image. It will be skipped during export.
        </p>
      )}
      {selectedCard &&
        selectedCard.frontSrc &&
        (!selectedCard.frontProcessedSrc || !selectedCard.frontCrop) && (
          <p className="mt-3 text-sm text-warning">
            Front crop required; this card will be skipped during export.
          </p>
        )}
      {selectedCard &&
        !selectedCard.backSrc &&
        !hasBackground(selectedCard, 'back') && (
          <p className="mt-3 text-sm text-warning">
            This card has no back image and no back background. No back will be printed.
          </p>
        )}

      {selectedCard && selectedIndex >= 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-box border border-base-300 bg-base-100 p-3">
          <span className="font-medium">Card {selectedIndex + 1}</span>
          <QuantityStepper
            quantity={selectedCard.quantity}
            cardLabel={`Card ${selectedIndex + 1}`}
            disabled={disabled}
            onStep={(direction) => onQuantityStep(selectedCard.id, direction)}
          />
          <span className="flex-1" />
          <button
            className="btn btn-outline min-h-11"
            type="button"
            disabled={disabled}
            onClick={() => onDuplicate(selectedCard.id)}
          >
            Duplicate
          </button>
          <button
            className="btn btn-outline btn-error min-h-11"
            type="button"
            disabled={disabled}
            onClick={() => onDelete(selectedCard.id)}
          >
            Delete
          </button>
        </div>
      )}
    </section>
  )
}
