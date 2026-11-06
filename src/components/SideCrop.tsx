import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { KeyboardEvent } from 'react'
import Cropper, { type Area, type MediaSize, type Point } from 'react-easy-crop'
import CardFace from './CardFace.tsx'
import type { Size } from '../lib/geometry.ts'
import { isLowRes } from '../lib/crop.ts'
import { effectiveDpiForSource } from '../lib/vectorSource.ts'
import { backgroundFor } from '../lib/piece.ts'
import { centeredMaximumCrop } from '../lib/cropConvert.ts'
import { renderCrop } from '../lib/renderCrop.ts'
import { shouldCommitCropEvent } from '../lib/cropEvents.ts'
import type { BleedMode, Card, CardBackground, CardSide, PixelCropRect } from '../types.ts'
import { createTranslator } from '../i18n/messages.ts'
import { en } from '../i18n/en.ts'
import { formatNumber } from '../i18n/numbers.ts'
import {
  clampZoom,
  COARSE_ZOOM_STEP,
  FINE_ZOOM_STEP,
  MAX_ZOOM,
  MIN_ZOOM,
  parseZoomInput,
} from '../lib/zoom.ts'

const translate = createTranslator(en, 'en')

export type SideCropProps = {
  card: Card
  side: CardSide
  source: string
  isVector: boolean
  processedSource?: string
  crop?: PixelCropRect
  cardSize: Size
  areaWidth: number
  areaHeight: number
  bleedMode: BleedMode
  bleed: number
  background: CardBackground
  error?: string
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
  onBackgroundToggle: (side: CardSide, enabled: boolean) => void
  onBackgroundChange: (side: CardSide, color: string) => void
  showImageActions?: boolean
  showHeading?: boolean
  extraControls?: ReactNode
}

function asCrop(area: Area): PixelCropRect {
  return { x: area.x, y: area.y, width: area.width, height: area.height }
}

export function SideCrop({
  card,
  side,
  source,
  isVector,
  processedSource,
  crop,
  cardSize,
  areaWidth,
  areaHeight,
  bleedMode,
  bleed,
  background,
  error,
  onImageSelect,
  onCropChange,
  onProcessedImage,
  onError,
  onImageRemove,
  onBackgroundToggle,
  onBackgroundChange,
  showImageActions = true,
  showHeading = true,
  extraControls,
}: SideCropProps) {
  const workspaceRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const renderId = useRef(0)
  const latestCrop = useRef<PixelCropRect | undefined>(undefined)
  const sliderChanging = useRef(false)
  const userActionInProgress = useRef(false)
  const zoomCommitFrame = useRef<number | undefined>(undefined)
  const seededMissingCrop = useRef(false)
  const [workspaceSize, setWorkspaceSize] = useState({ width: 0, height: 0 })
  const [cropPosition, setCropPosition] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [zoomInput, setZoomInput] = useState('1.00')
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
      if (zoomCommitFrame.current !== undefined) {
        window.cancelAnimationFrame(zoomCommitFrame.current)
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
        onProcessedImage(card.id, side, blob, nextCrop, source)
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
    if (
      shouldCommitCropEvent(
        userActionInProgress.current,
        sliderChanging.current,
      )
    ) {
      commitCrop(nextCrop)
    }
  }

  function finishZoomInteraction() {
    if (zoomCommitFrame.current !== undefined) {
      window.cancelAnimationFrame(zoomCommitFrame.current)
    }
    zoomCommitFrame.current = window.requestAnimationFrame(() => {
      sliderChanging.current = false
      if (latestCrop.current) commitCrop(latestCrop.current)
      userActionInProgress.current = false
    })
  }

  function handleZoomChange(value: number) {
    const nextZoom = clampZoom(value)
    userActionInProgress.current = true
    sliderChanging.current = true
    setZoom(nextZoom)
    setZoomInput(nextZoom.toFixed(2))
  }

  function commitZoomInput() {
    const parsed = parseZoomInput(zoomInput)
    if (parsed === undefined) {
      setZoomInput(zoom.toFixed(2))
      return
    }

    handleZoomChange(parsed)
    finishZoomInteraction()
  }

  function handleWorkspaceKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key.startsWith('Arrow')) {
      event.preventDefault()
      const step = event.shiftKey ? 10 : 1
      setCropPosition((position) => ({
        x: position.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
        y: position.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0),
      }))
      userActionInProgress.current = true
      sliderChanging.current = true
      return
    }

    const zoomOut = event.key === '-' || event.key === '_' || event.code === 'NumpadSubtract'
    const zoomIn = event.key === '+' || event.key === '=' || event.code === 'NumpadAdd'
    if (zoomIn || zoomOut) {
      event.preventDefault()
      const step = event.shiftKey ? FINE_ZOOM_STEP : COARSE_ZOOM_STEP
      handleZoomChange(zoom + (zoomOut ? -step : step))
    }
  }

  function handleWorkspaceKeyUp(event: KeyboardEvent<HTMLDivElement>) {
    const zoomKey =
      event.key === '+' ||
      event.key === '=' ||
      event.key === '-' ||
      event.key === '_' ||
      event.code === 'NumpadAdd' ||
      event.code === 'NumpadSubtract'
    if (
      event.key.startsWith('Arrow') ||
      zoomKey
    ) {
      finishZoomInteraction()
    }
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

  const dpi = crop
    ? effectiveDpiForSource({
        cropPixelWidth: crop.width,
        areaWidthPt: areaWidth,
        isVector,
      })
    : undefined
  const locale = new Intl.NumberFormat().resolvedOptions().locale
  const replaceImageKey =
    side === 'front' ? 'cardEditor.replace.front' : 'cardEditor.replace.back'
  const bleedInsetX = frameSize ? (bleed / areaWidth) * frameSize.width : 0
  const bleedInsetY = frameSize ? (bleed / areaHeight) * frameSize.height : 0
  const ringWidth = frameSize ? (bleed / cardSize.width) * frameSize.width : 0

  return (
    <section className="rounded-xl border border-[#2c3547] bg-[#10141c] p-4">
      {showHeading && (
        <h3 className="mb-3 text-lg font-semibold capitalize">{side}</h3>
      )}
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
        <div className="min-w-0">
          {source ? (
            <>
              <div
                ref={workspaceRef}
                className="cropper-workspace relative w-full overflow-hidden rounded-xl border border-[#2c3547] focus:outline focus:outline-2 focus:outline-primary focus:outline-offset-2"
                tabIndex={0}
                onPointerDownCapture={() => workspaceRef.current?.focus({ preventScroll: true })}
                onKeyDown={handleWorkspaceKeyDown}
                onKeyUp={handleWorkspaceKeyUp}
                style={{
                  height: showHeading ? 'min(70vh, 520px)' : 'min(70vh, 420px)',
                  maxHeight: '70vh',
                  backgroundColor: visibleBackground,
                }}
                aria-label={`${side} image crop workspace. Arrow keys pan, plus and minus zoom.`}
              >
                {frameSize && (
                  <Cropper
                    key={`${source}:${areaWidth}:${areaHeight}:${initialAreaKey}`}
                    image={source}
                    crop={cropPosition}
                    zoom={zoom}
                    minZoom={MIN_ZOOM}
                    maxZoom={MAX_ZOOM}
                    zoomWithScroll={false}
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
                    onZoomChange={(value) => {
                      setZoom(value)
                      setZoomInput(clampZoom(value).toFixed(2))
                    }}
                    onCropAreaChange={(_area, areaPixels) => {
                      latestCrop.current = asCrop(areaPixels)
                    }}
                    onCropComplete={handleCropComplete}
                    onMediaLoaded={handleMediaLoaded}
                    onInteractionStart={() => {
                      userActionInProgress.current = true
                    }}
                    onInteractionEnd={() => {
                      userActionInProgress.current = false
                    }}
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
              <p className="mt-2 text-xs text-[#a3adc2]">
                Click the image, then use your keyboard: arrow keys nudge the image (hold Shift for 10x). The + and - keys zoom by 0.1 (hold Shift for 0.01).
              </p>
              <div className="mt-4 max-w-[220px]">
                <p className="mb-2 text-sm font-medium">
                  {translate('cardEditor.liveResult')}
                </p>
                <CardFace
                  card={card}
                  side={side}
                  cardSize={cardSize}
                  showBleedRing={bleedMode === 'COLOR'}
                  aspectIncludesBleed={bleedMode === 'IMAGE'}
                  source={processedSource}
                  placeholder={
                    side === 'front' && source && !processedSource
                      ? 'Crop required'
                      : undefined
                  }
                  alt={`${side} live crop result`}
                />
              </div>
            </>
          ) : (
            <div className="mx-auto max-w-[300px]">
              <CardFace
                card={card}
                side={side}
                cardSize={cardSize}
                showBleedRing={bleedMode === 'COLOR'}
                aspectIncludesBleed={bleedMode === 'IMAGE'}
              />
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {isVector && source ? (
              <span className="badge badge-neutral">Vector</span>
            ) : dpi !== undefined ? (
              <>
                <span
                  className={`badge ${isLowRes(dpi) ? 'badge-warning' : 'badge-success'}`}
                >
                  {formatNumber(dpi, locale, { maximumFractionDigits: 0 })} DPI
                </span>
                <span className="text-sm text-[#a3adc2]">
                  {translate(
                    isLowRes(dpi)
                      ? 'cardEditor.dpi.low'
                      : 'cardEditor.dpi.good',
                  )}
                </span>
              </>
            ) : null}
          </div>

          <div className="flex gap-2">
            <button
              className="btn min-h-11 flex-1 border border-[#2c3547] bg-[#1f2633]"
              type="button"
              onClick={() => setFraming('FIT')}
              disabled={!mediaSize}
            >
              {translate('cardEditor.fit')}
            </button>
            <button
              className="btn min-h-11 flex-1 border border-[#2c3547] bg-[#1f2633]"
              type="button"
              onClick={() => setFraming('FILL')}
              disabled={!mediaSize}
            >
              {translate('cardEditor.fill')}
            </button>
            {showImageActions && (
              <>
                <input
                  ref={imageInputRef}
                  className="sr-only"
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.gif,.bmp,.avif,.svg,image/*"
                  aria-label={translate(replaceImageKey)}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0]
                    if (file) onImageSelect(side, file)
                    event.currentTarget.value = ''
                  }}
                />
                <button
                  className="btn min-h-11 flex-1 border border-[#2c3547] bg-[#1f2633]"
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                >
                  {translate('cardEditor.replace')}
                </button>
              </>
            )}
          </div>
          {showImageActions && (
            <button
              className="btn btn-outline min-h-11"
              type="button"
              disabled={!source}
              onClick={() => {
                if (imageInputRef.current) imageInputRef.current.value = ''
                onImageRemove(side)
              }}
            >
              {translate('cardEditor.removeImage')}
            </button>
          )}

          <label className="form-control">
            <span className="label-text mb-2">{translate('cardEditor.zoom')}</span>
            <input
              className="range range-primary range-sm min-h-11"
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={FINE_ZOOM_STEP}
              value={zoom}
              onChange={(event) => handleZoomChange(Number(event.currentTarget.value))}
              onPointerUp={finishZoomInteraction}
              onKeyUp={finishZoomInteraction}
              onBlur={finishZoomInteraction}
              title={translate('cardEditor.zoom.slider')}
              aria-label={translate('cardEditor.zoom.slider')}
            />
          </label>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <button
              className="btn h-11 min-h-11 w-11"
              type="button"
              aria-label={translate('cardEditor.zoom.outCoarse')}
              title={translate('cardEditor.zoom.outCoarse')}
              onClick={() => {
                handleZoomChange(zoom - COARSE_ZOOM_STEP)
                finishZoomInteraction()
              }}
            >
              −
            </button>
            <button
              className="btn h-11 min-h-11 w-11"
              type="button"
              aria-label={translate('cardEditor.zoom.inFine')}
              title={translate('cardEditor.zoom.inFine')}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                handleZoomChange(zoom + FINE_ZOOM_STEP)
                finishZoomInteraction()
              }}
            >
              ▲
            </button>
            <button
              className="btn h-11 min-h-11 w-11"
              type="button"
              aria-label={translate('cardEditor.zoom.outFine')}
              title={translate('cardEditor.zoom.outFine')}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                handleZoomChange(zoom - FINE_ZOOM_STEP)
                finishZoomInteraction()
              }}
            >
              ▼
            </button>
            <input
              className="input input-bordered zoom-number-input h-11 w-24 text-center"
              type="number"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={FINE_ZOOM_STEP}
              aria-label={translate('cardEditor.zoom.exact')}
              title={translate('cardEditor.zoom.exact')}
              value={zoomInput}
              onChange={(event) => setZoomInput(event.currentTarget.value)}
              onBlur={commitZoomInput}
              onKeyDown={(event) => {
                if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                  event.preventDefault()
                  const step = event.shiftKey
                    ? COARSE_ZOOM_STEP
                    : FINE_ZOOM_STEP
                  handleZoomChange(
                    zoom + (event.key === 'ArrowDown' ? -step : step),
                  )
                } else if (event.key === 'Enter') {
                  event.preventDefault()
                  event.currentTarget.blur()
                }
              }}
              onKeyUp={(event) => {
                if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                  finishZoomInteraction()
                }
              }}
            />
            <button
              className="btn h-11 min-h-11 w-11"
              type="button"
              aria-label={translate('cardEditor.zoom.inCoarse')}
              title={translate('cardEditor.zoom.inCoarse')}
              onClick={() => {
                handleZoomChange(zoom + COARSE_ZOOM_STEP)
                finishZoomInteraction()
              }}
            >
              +
            </button>
          </div>
          <p className="text-xs text-[#a3adc2]">
            {translate('cardEditor.zoom.steps')}
          </p>

          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              className="checkbox checkbox-sm"
              type="checkbox"
              checked={background.enabled}
              onChange={(event) => onBackgroundToggle(side, event.currentTarget.checked)}
            />
            <span>{translate('cardEditor.background')}</span>
            <input
              className="input input-bordered ml-auto h-11 w-12 p-1"
              type="color"
              aria-label={translate('cardEditor.backgroundColor')}
              value={background.color}
              onChange={(event) => onBackgroundChange(side, event.currentTarget.value)}
            />
          </label>
          {extraControls}
          {source && error && (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
