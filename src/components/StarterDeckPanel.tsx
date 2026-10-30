import { useEffect, useMemo, useRef, useState } from 'react'
import type { Size } from '../lib/geometry.ts'
import { DEFAULT_BLEED } from '../lib/geometry.ts'
import { cropAreaSize } from '../lib/crop.ts'
import {
  BACK_DESIGNS,
  BACK_PALETTES,
  backSvgToDataUrl,
  generateBackSvg,
  type BackDesignId,
} from '../lib/backDesigns.ts'
import { backSvgSize } from '../lib/starterDeckBuild.ts'
import { isSvgFile } from '../lib/vectorSource.ts'
import { getImageType } from '../lib/imageType.ts'
import type { Card, CardSide, PixelCropRect } from '../types.ts'
import { SideCrop } from './SideCrop.tsx'

const IMAGE_ACCEPT = '.png,.jpg,.jpeg,.webp,.gif,.bmp,.avif,.svg,image/*'
const numberFormat = new Intl.NumberFormat()

type PaletteId = (typeof BACK_PALETTES)[number]['id']

export type StarterBackChoice =
  | {
      type: 'design'
      design: BackDesignId
      paletteId: PaletteId
      border: boolean
    }
  | {
      type: 'image'
      file: File
      draftCard: Card
      processedBlob: Blob
    }

type StarterDeckPanelProps = {
  cardSize: Size
  presetName: string
  cardWidthMm: string
  cardHeightMm: string
  paperName: string
  paperLabel: string
  disabled: boolean
  isLoadingManifest: boolean
  isProcessing: boolean
  progress?: { done: number; total: number }
  error?: string
  includeJokers: boolean
  onIncludeJokersChange: (include: boolean) => void
  summaryText: string
  onCreate: (options: {
    includeJokers: boolean
    back: StarterBackChoice
  }) => Promise<boolean>
}

export default function StarterDeckPanel({
  cardSize,
  presetName,
  cardWidthMm,
  cardHeightMm,
  paperName,
  paperLabel,
  disabled,
  isLoadingManifest,
  isProcessing,
  progress,
  error,
  includeJokers,
  onIncludeJokersChange,
  summaryText,
  onCreate,
}: StarterDeckPanelProps) {
  const [backType, setBackType] = useState<'design' | 'image'>('design')
  const [design, setDesign] = useState<BackDesignId>(BACK_DESIGNS[1].id)
  const [paletteId, setPaletteId] = useState<PaletteId>(BACK_PALETTES[0].id)
  const [border, setBorder] = useState(true)
  const [imageFile, setImageFile] = useState<File>()
  const [draftCard, setDraftCard] = useState<Card>()
  const [processedBlob, setProcessedBlob] = useState<Blob>()
  const [cropError, setCropError] = useState<string | undefined>(undefined)
  const [cropResetMessage, setCropResetMessage] = useState<string | undefined>(undefined)
  const [cropResetRevision, setCropResetRevision] = useState(0)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const draftSourceUrl = useRef<string | undefined>(undefined)
  const draftProcessedUrl = useRef<string | undefined>(undefined)
  const previousGeometry = useRef({ cardSize, paperName })
  const palette = BACK_PALETTES.find((option) => option.id === paletteId) ?? BACK_PALETTES[0]
  const cropArea = cropAreaSize(cardSize, DEFAULT_BLEED, 'COLOR')
  const designPreviews = useMemo(
    () =>
      BACK_DESIGNS.filter(({ id }) => ['LATTICE', 'STRIPES', 'DOTS'].includes(id)).map(
        (option) => {
          const size = backSvgSize(cardSize)
          return {
            ...option,
            src: backSvgToDataUrl(
              generateBackSvg({
                design: option.id,
                width: size.width,
                height: size.height,
                primary: palette.primary,
                secondary: palette.secondary,
                border,
              }),
            ),
          }
        },
      ),
    [border, cardSize, palette],
  )
  useEffect(
    () => () => {
      if (draftSourceUrl.current) URL.revokeObjectURL(draftSourceUrl.current)
      if (draftProcessedUrl.current) URL.revokeObjectURL(draftProcessedUrl.current)
    },
    [],
  )

  function revokeDraftUrls() {
    if (draftSourceUrl.current) URL.revokeObjectURL(draftSourceUrl.current)
    if (draftProcessedUrl.current) URL.revokeObjectURL(draftProcessedUrl.current)
    draftSourceUrl.current = undefined
    draftProcessedUrl.current = undefined
  }

  function clearDraft() {
    revokeDraftUrls()
    setImageFile(undefined)
    setDraftCard(undefined)
    setProcessedBlob(undefined)
    setCropError(undefined)
    setCropResetMessage(undefined)
  }

  function replaceDraft(file: File) {
    const type = getImageType(file)
    const sourceFile =
      (!file.type || file.type.toLowerCase() === 'application/octet-stream') && type
        ? new Blob([file], { type })
        : file
    const source = URL.createObjectURL(sourceFile)
    revokeDraftUrls()
    draftSourceUrl.current = source
    setBackType('image')
    setImageFile(file)
    setDraftCard({
      id: 'starter-back-draft',
      bleedMode: 'COLOR',
      backSrc: source,
      backIsVector: isSvgFile(file),
      frontBackground: { enabled: false, color: '#ffffff' },
      backBackground: { enabled: false, color: '#ffffff' },
      bleedColor: '#ffffff',
      quantity: 1,
    })
    setProcessedBlob(undefined)
    setCropError(undefined)
    setCropResetMessage(undefined)
  }

  function handleCropChange(side: CardSide, crop: PixelCropRect) {
    if (side !== 'back') return
    if (draftProcessedUrl.current) URL.revokeObjectURL(draftProcessedUrl.current)
    draftProcessedUrl.current = undefined
    setProcessedBlob(undefined)
    setDraftCard((current) =>
      current ? { ...current, backCrop: crop, backProcessedSrc: undefined } : current,
    )
  }

  function handleProcessedImage(
    ...args: [string, CardSide, Blob, PixelCropRect, string]
  ) {
    const [, side, blob] = args
    if (side !== 'back') return
    if (draftProcessedUrl.current) URL.revokeObjectURL(draftProcessedUrl.current)
    const processedSource = URL.createObjectURL(blob)
    draftProcessedUrl.current = processedSource
    setProcessedBlob(blob)
    setDraftCard((current) =>
      current ? { ...current, backProcessedSrc: processedSource } : current,
    )
  }

  useEffect(() => {
    const previous = previousGeometry.current
    const geometryChanged =
      previous.cardSize.width !== cardSize.width ||
      previous.cardSize.height !== cardSize.height ||
      previous.paperName !== paperName
    previousGeometry.current = { cardSize, paperName }
    if (!geometryChanged || !draftCard?.backCrop) return

    if (draftProcessedUrl.current) URL.revokeObjectURL(draftProcessedUrl.current)
    draftProcessedUrl.current = undefined
    setDraftCard((current) =>
      current ? { ...current, backCrop: undefined, backProcessedSrc: undefined } : current,
    )
    setProcessedBlob(undefined)
    setCropError(undefined)
    setCropResetMessage('The card size changed. Choose the crop again.')
    setCropResetRevision((current) => current + 1)
  }, [cardSize, draftCard, paperName])

  async function handleCreate() {
    if (backType === 'image') {
      if (imageFile && draftCard?.backCrop && processedBlob) {
        const created = await onCreate({
          includeJokers,
          back: { type: 'image', file: imageFile, draftCard, processedBlob },
        })
        if (created) clearDraft()
      }
      return
    }
    await onCreate({
      includeJokers,
      back: { type: 'design', design, paletteId, border },
    })
  }

  const busy = disabled || isLoadingManifest || isProcessing
  const missingImage =
    backType === 'image' &&
    (!imageFile || !draftCard?.backCrop || !processedBlob)

  return (
    <section className="starter-panel" aria-labelledby="starter-title">
      <div className="starter-heading">
        <h2 id="starter-title">Standard 52-card deck</h2>
        <span>{presetName.charAt(0) + presetName.slice(1).toLowerCase()} size, {cardWidthMm} by {cardHeightMm} mm</span>
      </div>

      <fieldset className="starter-fieldset" disabled={busy}>
        <legend>1. Front set</legend>
        <label className="front-set-tile">
          <input type="radio" name="starter-front" checked readOnly aria-label="Classic front set" />
          <span className="front-set-cards" aria-hidden="true">
            <span>A♠</span><span className="red-suit">K♥</span><span className="red-suit">Q♦</span>
          </span>
          <span className="front-set-name">Classic</span>
          <span className="front-set-note">More sets can be added later</span>
        </label>
        <label className="include-jokers">
          <input
            type="checkbox"
            checked={includeJokers}
            onChange={(event) => onIncludeJokersChange(event.currentTarget.checked)}
          />
          <span>Include 2 Jokers</span>
        </label>
      </fieldset>

      <fieldset disabled={busy} className="starter-fieldset">
        <legend>2. Back</legend>
        <div className="back-design-grid">
          {designPreviews.map((option) => (
            <button
              key={option.id}
              className={`back-design-tile ${backType === 'design' && design === option.id ? 'is-selected' : ''}`}
              type="button"
              aria-pressed={backType === 'design' && design === option.id}
              onClick={() => {
                clearDraft()
                setDesign(option.id)
                setBackType('design')
              }}
            >
              <img
                src={option.src}
                alt=""
                style={{ aspectRatio: `${cardSize.width} / ${cardSize.height}` }}
              />
              {option.name}
            </button>
          ))}
          <button
            className={`back-design-tile image-tile ${backType === 'image' ? 'is-selected' : ''}`}
            type="button"
            aria-pressed={backType === 'image'}
            onClick={() => {
              setBackType('image')
              imageInputRef.current?.click()
            }}
          >
            <span className="image-tile-icon" aria-hidden="true">+</span>
            My image
          </button>
        </div>

        <input
          ref={imageInputRef}
          className="hidden"
          type="file"
          accept={IMAGE_ACCEPT}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            if (file) replaceDraft(file)
            event.currentTarget.value = ''
          }}
        />

        {backType === 'design' ? (
          <div className="back-options">
            <span className="color-label">Colors</span>
            <div className="color-swatches" role="group" aria-label="Back colors">
              {BACK_PALETTES.map((option) => (
                <button
                  key={option.id}
                  className={`color-swatch ${paletteId === option.id ? 'is-selected' : ''}`}
                  type="button"
                  aria-label={`Use ${option.name} colors.`}
                  aria-pressed={paletteId === option.id}
                  style={{
                    background: `linear-gradient(135deg, ${option.primary} 50%, ${option.secondary} 50%)`,
                  }}
                  onClick={() => setPaletteId(option.id)}
                />
              ))}
            </div>
            <label className="border-toggle">
              <input
                type="checkbox"
                checked={border}
                onChange={(event) => setBorder(event.currentTarget.checked)}
              />
              <span>Border</span>
            </label>
          </div>
        ) : (
          <div className="starter-image-flow">
            <p>Choosing My image opens a crop step for the back before the deck is made.</p>
            {draftCard?.backSrc ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn btn-outline min-h-11"
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                  >
                    Choose another image
                  </button>
                  <button
                    className="btn btn-outline min-h-11"
                    type="button"
                    disabled={!draftCard}
                    onClick={clearDraft}
                  >
                    Remove image
                  </button>
                </div>
                <SideCrop
                  key={`${draftCard.backSrc}:${cardSize.width}:${cardSize.height}:${paperName}:${cropResetRevision}`}
                  card={draftCard}
                  side="back"
                  source={draftCard.backSrc}
                  isVector={draftCard.backIsVector ?? false}
                  processedSource={draftCard.backProcessedSrc}
                  crop={draftCard.backCrop}
                  cardSize={cardSize}
                  areaWidth={cropArea.width}
                  areaHeight={cropArea.height}
                  bleedMode="COLOR"
                  bleed={DEFAULT_BLEED}
                  background={draftCard.backBackground}
                  error={cropError}
                  onImageSelect={(_side, file) => replaceDraft(file)}
                  onImageRemove={clearDraft}
                  onCropChange={handleCropChange}
                  onProcessedImage={handleProcessedImage}
                  onError={(_side, message) => setCropError(message)}
                  onBackgroundToggle={(_side, enabled) =>
                    setDraftCard((current) =>
                      current
                        ? {
                            ...current,
                            backBackground: { ...current.backBackground, enabled },
                          }
                        : current,
                    )
                  }
                  onBackgroundChange={(_side, color) =>
                    setDraftCard((current) =>
                      current
                        ? {
                            ...current,
                            backBackground: { ...current.backBackground, color },
                          }
                        : current,
                    )
                  }
                  showImageActions={false}
                />
              </>
            ) : (
              <button
                className="btn btn-outline min-h-11"
                type="button"
                onClick={() => imageInputRef.current?.click()}
              >
                Choose an image
              </button>
            )}
          </div>
        )}
      </fieldset>

      {missingImage && (
        <p className="text-sm text-base-content/70">Choose an image and crop before you create the deck.</p>
      )}
      {cropResetMessage && <p className="text-sm text-warning" role="status">{cropResetMessage}</p>}
      {cropError && <p className="text-sm text-error" role="alert">{cropError}</p>}
      {backType === 'image' && imageFile && imageFile.size > 1_000_000 && (
        <p className="text-sm text-warning">
          This image is large. The project file will contain a copy for every card.
        </p>
      )}
      <div className="starter-create-row">
        <button
          className="btn btn-primary min-h-[52px] rounded-lg px-7 text-base font-semibold"
          type="button"
          disabled={busy || missingImage}
          onClick={handleCreate}
        >
          Create deck
        </button>
        <span className="starter-summary">{summaryText}</span>
      </div>
      {isLoadingManifest && (
        <p className="text-sm" role="status">Loading the standard deck.</p>
      )}
      {isProcessing && progress && (
        <p className="text-sm" role="status" aria-live="polite">
          Processing card {numberFormat.format(progress.done)} of {numberFormat.format(progress.total)}.
        </p>
      )}
      {error && <p className="text-sm text-error" role="alert">{error}</p>}
    </section>
  )
}
