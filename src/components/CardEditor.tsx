import { useEffect, useMemo, useRef, useState } from 'react'
import Cropper, { type Area, type MediaSize, type Point } from 'react-easy-crop'
import CardFace from './CardFace.tsx'
import type { Size } from '../lib/geometry.ts'
import { DEFAULT_BLEED } from '../lib/geometry.ts'
import { cropAreaSize, effectiveDpi, isLowRes } from '../lib/crop.ts'
import { backgroundFor } from '../lib/piece.ts'
import { centeredMaximumCrop } from '../lib/cropConvert.ts'
import { renderCrop } from '../lib/renderCrop.ts'
import type { BleedMode, Card, CardSide, PixelCropRect } from '../types.ts'

const MIN_ZOOM = 0.01
const MAX_ZOOM = 10

type CardEditorProps = {
  card: Card
  cardSize: Size
  errors: Record<CardSide, string | undefined>
  onCardChange: (card: Card) => void
  onBleedModeChange: (cardId: string, mode: BleedMode) => void
  onImageSelect: (side: CardSide, file: File) => void
  onCropChange: (side: CardSide, crop: PixelCropRect) => void
  onProcessedImage: (side: CardSide, blob: Blob) => void
  onError: (side: CardSide, message: string | undefined) => void
}

type SideCropProps = {
  card: Card
  side: CardSide
  source: string
  processedSource?: string
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

function asCrop(area: Area): PixelCropRect {
  return { x: area.x, y: area.y, width: area.width, height: area.height }
}

function SideCrop({
  card,
  side,
  source,
  processedSource,
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
  const workspaceRef = useRef<HTMLDivElement>(null)
  const renderId = useRef(0)
  const latestCrop = useRef<PixelCropRect | undefined>(undefined)
  const sliderChanging = useRef(false)
  const zoomCommitTimer = useRef<number | undefined>(undefined)
  const seededMissingCrop = useRef(false)
  const [workspaceSize, setWorkspaceSize] = useState({ width: 0, height: 0 })
  const [cropPosition, setCropPosition] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [mediaSize, setMediaSize] = useState<MediaSize | undefined>(undefined)
  const aspect = areaWidth / areaHeight
  const visibleBackground = backgroundFor(card, side)
  const frameSize = useMemo(() => {
    if (workspaceSize.width <= 0 || workspaceSize.height <= 0) return undefined

    const ringFactor =
      bleedMode === 'COLOR' ? (2 * bleed) / cardSize.width : 0
    const frameWidth = Math.min(
      (workspaceSize.width - 32) / (1 + ringFactor),
      (workspaceSize.height - 32) / (1 / aspect + ringFactor),
    )
    if (frameWidth <= 0) return undefined

    return { width: frameWidth, height: frameWidth / aspect }
  }, [
    aspect,
    bleed,
    bleedMode,
    cardSize.width,
    workspaceSize.height,
    workspaceSize.width,
  ])
  const initialAreaKey = crop
    ? `${crop.x}:${crop.y}:${crop.width}:${crop.height}`
    : 'fill'

  useEffect(() => {
    const workspace = workspaceRef.current
    if (!workspace) return

    const observer = new ResizeObserver(([entry]) => {
      setWorkspaceSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })
    observer.observe(workspace)
    return () => observer.disconnect()
  }, [])

  useEffect(
    () => () => {
      renderId.current += 1
      if (zoomCommitTimer.current !== undefined) {
        window.clearTimeout(zoomCommitTimer.current)
      }
    },
    [],
  )

  function commitCrop(nextCrop: PixelCropRect) {
    latestCrop.current = nextCrop
    onCropChange(side, nextCrop)

    const currentRenderId = ++renderId.current
    void renderCrop(source, nextCrop, { width: areaWidth, height: areaHeight })
      .then((blob) => {
        if (currentRenderId !== renderId.current) return
        onError(side, undefined)
        onProcessedImage(side, blob)
      })
      .catch((renderError: unknown) => {
        if (currentRenderId !== renderId.current) return
        onError(
          side,
          renderError instanceof Error
            ? renderError.message
            : 'Could not create the crop preview.',
        )
      })
  }

  function handleMediaLoaded(size: MediaSize) {
    setMediaSize(size)
    if (crop || seededMissingCrop.current) return

    seededMissingCrop.current = true
    const initialCrop = centeredMaximumCrop(
      { width: size.naturalWidth, height: size.naturalHeight },
      { width: areaWidth, height: areaHeight },
    )
    commitCrop(initialCrop)
  }

  function handleCropComplete(_area: Area, areaPixels: Area) {
    const nextCrop = asCrop(areaPixels)
    latestCrop.current = nextCrop
    if (!sliderChanging.current) commitCrop(nextCrop)
  }

  function handleZoomChange(value: number) {
    sliderChanging.current = true
    setZoom(value)
    if (zoomCommitTimer.current !== undefined) {
      window.clearTimeout(zoomCommitTimer.current)
    }
    zoomCommitTimer.current = window.setTimeout(() => {
      sliderChanging.current = false
      if (latestCrop.current) commitCrop(latestCrop.current)
    }, 180)
  }

  function setFraming(mode: 'FILL' | 'FIT') {
    if (!mediaSize) return

    const imageSize = {
      width: mediaSize.naturalWidth,
      height: mediaSize.naturalHeight,
    }
    const targetArea = { width: areaWidth, height: areaHeight }
    let nextCrop: PixelCropRect
    if (mode === 'FILL') {
      nextCrop = centeredMaximumCrop(imageSize, targetArea)
    } else {
      const scale = Math.max(
        imageSize.width / targetArea.width,
        imageSize.height / targetArea.height,
      )
      const width = targetArea.width * scale
      const height = targetArea.height * scale
      nextCrop = {
        x: (imageSize.width - width) / 2,
        y: (imageSize.height - height) / 2,
        width,
        height,
      }
    }
    commitCrop(nextCrop)
  }

  const dpi = crop ? effectiveDpi(crop.width, areaWidth) : undefined
  const bleedInsetX = frameSize ? (bleed / areaWidth) * frameSize.width : 0
  const bleedInsetY = frameSize ? (bleed / areaHeight) * frameSize.height : 0
  const ringWidth = frameSize ? (bleed / cardSize.width) * frameSize.width : 0

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

      {source ? (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(140px,220px)]">
          <div>
            <div
              ref={workspaceRef}
              className="cropper-workspace relative w-full overflow-hidden rounded-box"
              style={{
                height: 'min(70vh, 520px)',
                maxHeight: '70vh',
                backgroundColor: visibleBackground,
              }}
              aria-label={`${side} image crop workspace`}
            >
              {frameSize && (
                <Cropper
                  key={`${source}:${areaWidth}:${areaHeight}:${initialAreaKey}`}
                  image={source}
                  crop={cropPosition}
                  zoom={zoom}
                  minZoom={MIN_ZOOM}
                  maxZoom={MAX_ZOOM}
                  aspect={aspect}
                  cropSize={frameSize}
                  cropShape="rect"
                  objectFit="contain"
                  restrictPosition={false}
                  showGrid={false}
                  initialCroppedAreaPixels={crop}
                  mediaProps={{
                    alt: `${side} crop source`,
                    onError: () =>
                      onError(side, 'This image could not be loaded. Try another file.'),
                  }}
                  style={{
                    containerStyle: { width: '100%', height: '100%' },
                  }}
                  onCropChange={setCropPosition}
                  onZoomChange={setZoom}
                  onCropAreaChange={(_area, areaPixels) => {
                    latestCrop.current = asCrop(areaPixels)
                  }}
                  onCropComplete={handleCropComplete}
                  onMediaLoaded={handleMediaLoaded}
                />
              )}
              {frameSize && bleedMode === 'COLOR' && (
                <div
                  aria-hidden="true"
                  className="crop-bleed-ring pointer-events-none absolute left-1/2 top-1/2 z-10"
                  style={{
                    width: frameSize.width,
                    height: frameSize.height,
                    boxSizing: 'border-box',
                    boxShadow: `0 0 0 ${ringWidth}px ${card.bleedColor}`,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              )}
              {frameSize && bleedMode === 'IMAGE' && (
                <div
                  aria-hidden="true"
                  className="trim-line pointer-events-none absolute left-1/2 top-1/2 z-10"
                  style={{
                    width: frameSize.width - 2 * bleedInsetX,
                    height: frameSize.height - 2 * bleedInsetY,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                className="btn btn-sm btn-outline"
                type="button"
                onClick={() => setFraming('FILL')}
                disabled={!mediaSize}
              >
                Fill
              </button>
              <button
                className="btn btn-sm btn-outline"
                type="button"
                onClick={() => setFraming('FIT')}
                disabled={!mediaSize}
              >
                Fit
              </button>
              <label className="form-control min-w-40 flex-1">
                <span className="label-text mb-1">Zoom · {zoom.toFixed(2)}×</span>
                <input
                  className="range range-primary range-sm"
                  type="range"
                  min={MIN_ZOOM}
                  max={MAX_ZOOM}
                  step={0.01}
                  value={zoom}
                  onChange={(event) => handleZoomChange(Number(event.currentTarget.value))}
                />
              </label>
            </div>
          </div>

          <div className="min-w-0">
            <p className="mb-2 text-sm font-medium">Live result</p>
            <CardFace
              card={card}
              side={side}
              cardSize={cardSize}
              showBleedRing={bleedMode === 'COLOR'}
              aspectIncludesBleed={bleedMode === 'IMAGE'}
              source={processedSource}
              placeholder={side === 'front' ? 'Crop required' : 'No back'}
              alt={`${side} live crop result`}
            />
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-[300px]">
          <CardFace
            card={card}
            side={side}
            cardSize={cardSize}
            showBleedRing={bleedMode === 'COLOR'}
            aspectIncludesBleed={bleedMode === 'IMAGE'}
            placeholder={side === 'front' ? 'Crop required' : 'No back'}
          />
        </div>
      )}

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
  errors,
  onCardChange,
  onBleedModeChange,
  onImageSelect,
  onCropChange,
  onProcessedImage,
  onError,
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
          const processedSource =
            side === 'front' ? card.frontProcessedSrc : card.backProcessedSrc
          const crop = side === 'front' ? card.frontCrop : card.backCrop
          const backgroundKey =
            side === 'front' ? 'frontBackgroundColor' : 'backBackgroundColor'
          const sideBackground = card[backgroundKey]

          return (
            <SideCrop
              key={`${side}-${source ?? 'empty'}`}
              card={card}
              side={side}
              source={source ?? ''}
              processedSource={processedSource}
              crop={crop}
              cardSize={cardSize}
              areaWidth={area.width}
              areaHeight={area.height}
              bleedMode={card.bleedMode}
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
