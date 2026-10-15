import { useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from 'react'
import ReactCrop, { type PixelCrop } from 'react-image-crop'
import CardFace from './CardFace.tsx'
import type { Size } from '../lib/geometry.ts'
import { DEFAULT_BLEED } from '../lib/geometry.ts'
import { cropAreaSize, effectiveDpi, isLowRes } from '../lib/crop.ts'
import { backgroundFor } from '../lib/piece.ts'
import type { BleedMode, Card, CardSide, PixelCropRect } from '../types.ts'

type CardEditorProps = {
  card: Card
  cardSize: Size
  bleedMode: BleedMode
  errors: Record<CardSide, string | undefined>
  onCardChange: (card: Card) => void
  onImageSelect: (side: CardSide, file: File) => void
  onCropChange: (side: CardSide, crop: PixelCropRect) => void
  onProcessedImage: (side: CardSide, blob: Blob) => void
  onError: (side: CardSide, message: string | undefined) => void
}

type SideCropProps = {
  card: Card
  side: CardSide
  source: string
  crop?: PixelCropRect
  cardSize: Size
  areaWidth: number
  areaHeight: number
  bleedMode: BleedMode
  bleed: number
  backgroundColor?: string
  error?: string
  onImageSelect: (side: CardSide, file: File) => void
  onCropChange: (side: CardSide, crop: PixelCropRect) => void
  onProcessedImage: (side: CardSide, blob: Blob) => void
  onError: (side: CardSide, message: string | undefined) => void
  onBackgroundToggle: (side: CardSide, enabled: boolean) => void
  onBackgroundChange: (side: CardSide, color: string) => void
}

function SideCrop({
  card,
  side,
  source,
  crop,
  cardSize,
  areaWidth,
  areaHeight,
  bleedMode,
  bleed,
  backgroundColor,
  error,
  onImageSelect,
  onCropChange,
  onProcessedImage,
  onError,
  onBackgroundToggle,
  onBackgroundChange,
}: SideCropProps) {
  const imageRef = useRef<HTMLImageElement>(null)
  const renderId = useRef(0)
  const [imageDimensions, setImageDimensions] = useState<{
    width: number
    height: number
    naturalWidth: number
    naturalHeight: number
  }>()
  const aspect = areaWidth / areaHeight
  const scaleX = imageDimensions ? imageDimensions.naturalWidth / imageDimensions.width : 1
  const scaleY = imageDimensions ? imageDimensions.naturalHeight / imageDimensions.height : 1
  const displayCrop: PixelCrop | undefined = crop
    ? {
        unit: 'px',
        x: crop.x / scaleX,
        y: crop.y / scaleY,
        width: crop.width / scaleX,
        height: crop.height / scaleY,
      }
    : undefined
  const trimLineStyle: CSSProperties = {
    top: `${(bleed / areaHeight) * 100}%`,
    right: `${(bleed / areaWidth) * 100}%`,
    bottom: `${(bleed / areaHeight) * 100}%`,
    left: `${(bleed / areaWidth) * 100}%`,
  }

  useEffect(
    () => () => {
      renderId.current += 1
    },
    [],
  )

  function toNaturalCrop(pixelCrop: PixelCrop): PixelCropRect | undefined {
    const currentImage = imageRef.current
    if (!currentImage?.width || !currentImage.height) return undefined

    const naturalScaleX = currentImage.naturalWidth / currentImage.width
    const naturalScaleY = currentImage.naturalHeight / currentImage.height
    return {
      x: pixelCrop.x * naturalScaleX,
      y: pixelCrop.y * naturalScaleY,
      width: pixelCrop.width * naturalScaleX,
      height: pixelCrop.height * naturalScaleY,
    }
  }

  function handleCropChange(pixelCrop: PixelCrop) {
    renderId.current += 1
    const naturalCrop = toNaturalCrop(pixelCrop)
    if (naturalCrop) onCropChange(side, naturalCrop)
  }

  function handleCropComplete(pixelCrop: PixelCrop) {
    const currentImage = imageRef.current
    const naturalCrop = toNaturalCrop(pixelCrop)
    if (!currentImage || !naturalCrop) return

    const currentRenderId = ++renderId.current
    const canvas = document.createElement('canvas')
    canvas.width = Math.round((areaWidth * 300) / 72)
    canvas.height = Math.round((areaHeight * 300) / 72)

    const context = canvas.getContext('2d')
    if (!context) {
      onError(side, 'Could not prepare the crop preview.')
      return
    }

    context.drawImage(
      currentImage,
      naturalCrop.x,
      naturalCrop.y,
      naturalCrop.width,
      naturalCrop.height,
      0,
      0,
      canvas.width,
      canvas.height,
    )
    canvas.toBlob((blob) => {
      if (currentRenderId !== renderId.current) return
      if (!blob) {
        onError(side, 'Could not create the crop preview.')
        return
      }

      onError(side, undefined)
      onProcessedImage(side, blob)
    }, 'image/png')
  }

  function handleImageLoad(event: SyntheticEvent<HTMLImageElement>) {
    const loadedImage = event.currentTarget
    setImageDimensions({
      width: loadedImage.width,
      height: loadedImage.height,
      naturalWidth: loadedImage.naturalWidth,
      naturalHeight: loadedImage.naturalHeight,
    })
    if (crop || !loadedImage.width || !loadedImage.height) return

    const displayWidth = loadedImage.width
    const displayHeight = loadedImage.height
    let cropWidth = Math.min(displayWidth, displayHeight * aspect)
    let cropHeight = cropWidth / aspect
    if (cropHeight > displayHeight) {
      cropHeight = displayHeight
      cropWidth = cropHeight * aspect
    }

    handleCropChange({
      unit: 'px',
      x: (displayWidth - cropWidth) / 2,
      y: (displayHeight - cropHeight) / 2,
      width: cropWidth,
      height: cropHeight,
    })
  }

  const dpi = crop ? effectiveDpi(crop.width, areaWidth) : undefined

  return (
    <section className="rounded-box border border-base-300 bg-base-100 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold capitalize">{side}</h3>
        {dpi !== undefined && (
          <span className={`badge ${isLowRes(dpi) ? 'badge-warning' : 'badge-success'}`}>
            {dpi.toFixed(0)} DPI
          </span>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-4">
        <label className="label cursor-pointer justify-start gap-2">
          <input
            className="checkbox checkbox-sm"
            type="checkbox"
            checked={backgroundColor !== undefined}
            onChange={(event) => onBackgroundToggle(side, event.currentTarget.checked)}
          />
          <span className="label-text">Background</span>
        </label>
        {backgroundColor !== undefined && (
          <label className="form-control w-fit">
            <span className="label-text mb-1">Background color</span>
            <input
              className="input input-bordered h-12 w-20 p-1"
              type="color"
              value={backgroundColor}
              onChange={(event) => onBackgroundChange(side, event.currentTarget.value)}
            />
          </label>
        )}
      </div>

      <label className="form-control mb-3 w-full">
        <span className="label-text mb-1">Upload {side} image</span>
        <input
          className="file-input file-input-bordered w-full"
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            if (file) onImageSelect(side, file)
            event.currentTarget.value = ''
          }}
        />
      </label>

      <CardFace
        card={card}
        side={side}
        cardSize={cardSize}
        showBleedRing={bleedMode === 'COLOR'}
        aspectIncludesBleed
        source={source}
        placeholder={side === 'front' ? 'Crop required' : 'No back'}
        className="mx-auto max-w-[300px]"
      >
        {source ? (
          <ReactCrop
            crop={displayCrop}
            aspect={aspect}
            keepSelection
            className="h-full w-full"
            style={{ height: '100%', width: '100%' }}
            onChange={handleCropChange}
            onComplete={handleCropComplete}
            renderSelectionAddon={
              bleedMode === 'IMAGE'
                ? () => <div className="trim-line" style={trimLineStyle} />
                : undefined
            }
          >
            <img
              ref={imageRef}
              src={source}
              alt={`${side} crop`}
              onLoad={handleImageLoad}
              onError={() => onError(side, 'This image could not be loaded. Try another file.')}
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                objectFit: 'fill',
              }}
            />
          </ReactCrop>
        ) : undefined}
      </CardFace>
      {source && dpi !== undefined && isLowRes(dpi) && (
        <p className="mt-2 text-sm text-warning">
          This crop is below 200 DPI and may print blurry.
        </p>
      )}
      {source && error && (
        <p role="alert" className="mt-2 text-sm text-error">
          {error}
        </p>
      )}
    </section>
  )
}

export default function CardEditor({
  card,
  cardSize,
  bleedMode,
  errors,
  onCardChange,
  onImageSelect,
  onCropChange,
  onProcessedImage,
  onError,
}: CardEditorProps) {
  const area = cropAreaSize(cardSize, DEFAULT_BLEED, bleedMode)

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
        {bleedMode === 'COLOR' && (
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

      <div className="grid gap-6 lg:grid-cols-2">
        {(['front', 'back'] as const).map((side) => {
          const source = side === 'front' ? card.frontSrc : card.backSrc
          const crop = side === 'front' ? card.frontCrop : card.backCrop
          const backgroundKey =
            side === 'front' ? 'frontBackgroundColor' : 'backBackgroundColor'
          const sideBackground = card[backgroundKey]

          return (
            <SideCrop
              key={`${side}-${source ?? 'empty'}-${area.width}-${area.height}`}
              card={card}
              side={side}
              source={source ?? ''}
              crop={crop}
              cardSize={cardSize}
              areaWidth={area.width}
              areaHeight={area.height}
              bleedMode={bleedMode}
              bleed={DEFAULT_BLEED}
              backgroundColor={sideBackground}
              error={errors[side]}
              onImageSelect={onImageSelect}
              onCropChange={onCropChange}
              onProcessedImage={onProcessedImage}
              onError={onError}
              onBackgroundToggle={(selectedSide, enabled) => {
                const key =
                  selectedSide === 'front'
                    ? 'frontBackgroundColor'
                    : 'backBackgroundColor'
                onCardChange({
                  ...card,
                  [key]: enabled ? backgroundFor(card, selectedSide) : undefined,
                })
              }}
              onBackgroundChange={(selectedSide, color) => {
                const key =
                  selectedSide === 'front'
                    ? 'frontBackgroundColor'
                    : 'backBackgroundColor'
                onCardChange({ ...card, [key]: color })
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
