import CardEditor from './CardEditor.tsx'
import type { Size } from '../lib/geometry.ts'
import type { BleedMode, Card, CardSide, PixelCropRect } from '../types.ts'

type SelectedCardEditorProps = {
  card?: Card
  cardSize: Size
  errors: Record<CardSide, string | undefined>
  onCardChange: (card: Card) => void
  onBleedModeChange: (cardId: string, mode: BleedMode) => void
  onImageSelect: (side: CardSide, file: File) => void
  onImageRemove: (side: CardSide) => void
  onCropChange: (side: CardSide, crop: PixelCropRect) => void
  onProcessedImage: (
    cardId: string,
    side: CardSide,
    blob: Blob,
    crop: PixelCropRect,
    source: string,
  ) => void
  onError: (side: CardSide, message: string | undefined) => void
  onUseBackForEveryCard: () => void
}

export default function SelectedCardEditor({
  card,
  cardSize,
  errors,
  onCardChange,
  onBleedModeChange,
  onImageSelect,
  onImageRemove,
  onCropChange,
  onProcessedImage,
  onError,
  onUseBackForEveryCard,
}: SelectedCardEditorProps) {
  return card ? (
    <section className="mb-6">
      <h2 className="mb-3 text-xl font-semibold">Edit selected card</h2>
      <CardEditor
        key={card.id}
        card={card}
        cardSize={cardSize}
        errors={errors}
        onCardChange={onCardChange}
        onBleedModeChange={onBleedModeChange}
        onImageSelect={onImageSelect}
        onImageRemove={onImageRemove}
        onCropChange={onCropChange}
        onProcessedImage={onProcessedImage}
        onError={onError}
        onUseBackForEveryCard={onUseBackForEveryCard}
      />
    </section>
  ) : (
    <p className="mb-6 rounded-box bg-base-100 p-6 text-center text-base-content/60">
      Add a card to start building your deck.
    </p>
  )
}
