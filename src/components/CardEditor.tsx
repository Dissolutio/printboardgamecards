import { SideCrop } from './SideCrop.tsx'
import type { Size } from '../lib/geometry.ts'
import { DEFAULT_BLEED } from '../lib/geometry.ts'
import { cropAreaSize } from '../lib/crop.ts'
import { withBackgroundEnabled } from '../lib/piece.ts'
import type { BleedMode, Card, CardSide, PixelCropRect } from '../types.ts'

type CardEditorProps = {
  card: Card
  cardSize: Size
  errors: Record<CardSide, string | undefined>
  onCardChange: (card: Card) => void
  onBleedModeChange: (cardId: string, mode: BleedMode) => void
  onImageSelect: (side: CardSide, file: File) => void
  onImageRemove: (side: CardSide) => void
  onCropChange: (side: CardSide, crop: PixelCropRect) => void
  onProcessedImage: (side: CardSide, blob: Blob) => void
  onError: (side: CardSide, message: string | undefined) => void
  onUseBackForEveryCard: () => void
}

export default function CardEditor({
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
}: CardEditorProps) {
  const area = cropAreaSize(cardSize, DEFAULT_BLEED, card.bleedMode)

  return (
    <div className="space-y-6">
      <section className="rounded-box border border-base-300 bg-base-100 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <p className="self-center text-sm text-base-content/60">
            Card size: {cardSize.width} × {cardSize.height} pt trim
          </p>
          <label className="form-control">
            <span className="label-text mb-1">Copies of this card</span>
            <input
              className="input input-bordered w-full"
              type="number"
              min={1}
              step={1}
              value={card.quantity}
              onChange={(event) => {
                const quantity = Number(event.currentTarget.value)
                if (Number.isInteger(quantity) && quantity >= 1) {
                  onCardChange({ ...card, quantity })
                }
              }}
            />
          </label>
        </div>
        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium">Bleed mode for this card</legend>
          <div className="join">
            <button
              className={`btn join-item ${card.bleedMode === 'IMAGE' ? 'btn-primary' : 'btn-outline'}`}
              type="button"
              aria-pressed={card.bleedMode === 'IMAGE'}
              onClick={() => onBleedModeChange(card.id, 'IMAGE')}
            >
              Extend image
            </button>
            <button
              className={`btn join-item ${card.bleedMode === 'COLOR' ? 'btn-primary' : 'btn-outline'}`}
              type="button"
              aria-pressed={card.bleedMode === 'COLOR'}
              onClick={() => onBleedModeChange(card.id, 'COLOR')}
            >
              Solid color
            </button>
          </div>
        </fieldset>
        {card.bleedMode === 'COLOR' && (
          <label className="form-control mt-4 w-fit">
            <span className="label-text mb-1">Bleed color</span>
            <input
              className="input input-bordered h-12 w-20 p-1"
              type="color"
              value={card.bleedColor}
              onChange={(event) =>
                onCardChange({ ...card, bleedColor: event.currentTarget.value })
              }
            />
          </label>
        )}
        <p className="mt-3 text-sm text-base-content/60">
          {DEFAULT_BLEED} pt bleed · Crop area {area.width} × {area.height} pt
        </p>
      </section>

      <div className="space-y-6">
        {(['front', 'back'] as const).map((side) => {
          const source = side === 'front' ? card.frontSrc : card.backSrc
          const isVector = side === 'front' ? card.frontIsVector : card.backIsVector
          const processedSource =
            side === 'front' ? card.frontProcessedSrc : card.backProcessedSrc
          const crop = side === 'front' ? card.frontCrop : card.backCrop
          const backgroundKey = side === 'front' ? 'frontBackground' : 'backBackground'
          const sideBackground = card[backgroundKey]

          return (
            <SideCrop
              key={`${side}-${source ?? 'empty'}`}
              card={card}
              side={side}
              source={source ?? ''}
              isVector={isVector ?? false}
              processedSource={processedSource}
              crop={crop}
              cardSize={cardSize}
              areaWidth={area.width}
              areaHeight={area.height}
              bleedMode={card.bleedMode}
              bleed={DEFAULT_BLEED}
              background={sideBackground}
              error={errors[side]}
              onImageSelect={onImageSelect}
              onImageRemove={onImageRemove}
              onCropChange={onCropChange}
              onProcessedImage={onProcessedImage}
              onError={onError}
              onUseBackForEveryCard={onUseBackForEveryCard}
              onBackgroundToggle={(selectedSide, enabled) => {
                const key = selectedSide === 'front' ? 'frontBackground' : 'backBackground'
                onCardChange({
                  ...card,
                  [key]: withBackgroundEnabled(card[key], enabled),
                })
              }}
              onBackgroundChange={(selectedSide, color) => {
                const key = selectedSide === 'front' ? 'frontBackground' : 'backBackground'
                onCardChange({ ...card, [key]: { ...card[key], color } })
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
