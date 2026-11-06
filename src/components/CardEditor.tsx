import type { ReactNode } from 'react'
import { SideCrop } from './SideCrop.tsx'
import type { Size } from '../lib/geometry.ts'
import { DEFAULT_BLEED } from '../lib/geometry.ts'
import { cropAreaSize } from '../lib/crop.ts'
import { withBackgroundEnabled } from '../lib/piece.ts'
import type { BleedMode, Card, CardSide, PixelCropRect } from '../types.ts'
import { createTranslator } from '../i18n/messages.ts'
import { en } from '../i18n/en.ts'

const translate = createTranslator(en, 'en')

type CardEditorProps = {
  card: Card
  side: CardSide
  backPanel?: ReactNode
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
}

export default function CardEditor({
  card,
  side,
  backPanel,
  cardSize,
  errors,
  onCardChange,
  onBleedModeChange,
  onImageSelect,
  onImageRemove,
  onCropChange,
  onProcessedImage,
  onError,
}: CardEditorProps) {
  const area = cropAreaSize(cardSize, DEFAULT_BLEED, card.bleedMode)
  const source = side === 'front' ? card.frontSrc : card.backSrc
  const isVector = side === 'front' ? card.frontIsVector : card.backIsVector
  const processedSource =
    side === 'front' ? card.frontProcessedSrc : card.backProcessedSrc
  const crop = side === 'front' ? card.frontCrop : card.backCrop
  const backgroundKey = side === 'front' ? 'frontBackground' : 'backBackground'
  const sideBackground = card[backgroundKey]

  return (
    <div className="space-y-4">
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
        showHeading={false}
        extraControls={backPanel}
        onImageSelect={onImageSelect}
        onImageRemove={onImageRemove}
        onCropChange={onCropChange}
        onProcessedImage={onProcessedImage}
        onError={onError}
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

      <section className="rounded-xl border border-[#2c3547] bg-[#1f2633] p-4">
        <h3 className="mb-3 text-sm font-semibold">{translate('cardEditor.bleed.title')}</h3>
        <fieldset>
          <legend className="sr-only">{translate('cardEditor.bleed.mode')}</legend>
          <div className="flex flex-wrap gap-2">
            <button
              className={`btn min-h-11 ${card.bleedMode === 'IMAGE' ? 'btn-primary' : 'btn-outline'}`}
              type="button"
              aria-pressed={card.bleedMode === 'IMAGE'}
              onClick={() => onBleedModeChange(card.id, 'IMAGE')}
            >
              {translate('cardEditor.bleed.extendImage')}
            </button>
            <button
              className={`btn min-h-11 ${card.bleedMode === 'COLOR' ? 'btn-primary' : 'btn-outline'}`}
              type="button"
              aria-pressed={card.bleedMode === 'COLOR'}
              onClick={() => onBleedModeChange(card.id, 'COLOR')}
            >
              {translate('cardEditor.bleed.solidColor')}
            </button>
          </div>
        </fieldset>
        {card.bleedMode === 'COLOR' && (
          <label className="form-control mt-3 w-fit">
            <span className="label-text mb-1">{translate('cardEditor.bleed.color')}</span>
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
        <p className="mt-3 text-sm text-[#a3adc2]">
          {translate('cardEditor.bleed.summary', { bleed: DEFAULT_BLEED })}
        </p>
        <p className="text-sm text-[#a3adc2]">
          {translate('cardEditor.bleed.cropArea', {
            width: area.width,
            height: area.height,
          })}
        </p>
        <p className="text-sm text-[#a3adc2]">
          {translate('cardEditor.bleed.cardSize', {
            width: cardSize.width,
            height: cardSize.height,
          })}
        </p>
      </section>
    </div>
  )
}
