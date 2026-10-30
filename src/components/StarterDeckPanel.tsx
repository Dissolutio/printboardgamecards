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
  paperName: string
  disabled: boolean
  isLoadingManifest: boolean
  isProcessing: boolean
  progress?: { done: number; total: number }
  error?: string
  onCreate: (options: {
    includeJokers: boolean
    back: StarterBackChoice
  }) => Promise<boolean>
}

export default function StarterDeckPanel({
  cardSize,
  paperName,
  disabled,
  isLoadingManifest,
  isProcessing,
  progress,
  error,
  onCreate,
}: StarterDeckPanelProps) {
  const [includeJokers, setIncludeJokers] = useState(false)
  const [backType, setBackType] = useState<'design' | 'image'>('design')
  const [design, setDesign] = useState<BackDesignId>(BACK_DESIGNS[0].id)
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
  const selectedDesign = BACK_DESIGNS.find((option) => option.id === design) ?? BACK_DESIGNS[0]
  const cropArea = cropAreaSize(cardSize, DEFAULT_BLEED, 'COLOR')
  const generatedPreview = useMemo(() => {
    const size = backSvgSize(cardSize)
    return backSvgToDataUrl(
      generateBackSvg({
        design,
        width: size.width,
        height: size.height,
        primary: palette.primary,
        secondary: palette.secondary,
        border,
      }),
    )
  }, [border, cardSize, design, palette])

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
    <section className="mb-6 space-y-4 rounded-box border border-base-300 bg-base-100 p-5">
      <h2 className="text-lg font-semibold">Standard deck</h2>
      <label className="label cursor-pointer justify-start gap-2">
        <input
          className="checkbox checkbox-sm"
          type="checkbox"
          checked={includeJokers}
          disabled={busy}
          onChange={(event) => setIncludeJokers(event.currentTarget.checked)}
        />
        <span className="label-text">Include 2 Jokers</span>
      </label>

      <fieldset disabled={busy} className="space-y-4">
        <legend className="label-text mb-2">Card back</legend>
        <div className="flex flex-wrap gap-4">
          <label className="label cursor-pointer justify-start gap-2">
            <input
              className="radio radio-sm"
              type="radio"
              name="starter-back-type"
              value="design"
              checked={backType === 'design'}
              onChange={() => {
                clearDraft()
                setBackType('design')
              }}
            />
            <span className="label-text">Design</span>
          </label>
          <label className="label cursor-pointer justify-start gap-2">
            <input
              className="radio radio-sm"
              type="radio"
              name="starter-back-type"
              value="image"
              checked={backType === 'image'}
              onChange={() => setBackType('image')}
            />
            <span className="label-text">My image</span>
          </label>
        </div>

        {backType === 'design' ? (
          <div className="flex flex-wrap items-end gap-4">
            <label className="form-control min-w-48">
              <span className="label-text mb-1">Design</span>
              <select
                className="select select-bordered"
                value={design}
                onChange={(event) => {
                  const selected = BACK_DESIGNS.find(
                    (option) => option.id === event.currentTarget.value,
                  )
                  if (selected) setDesign(selected.id)
                }}
              >
                {BACK_DESIGNS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-control min-w-48">
              <span className="label-text mb-1">Palette</span>
              <select
                className="select select-bordered"
                value={paletteId}
                onChange={(event) => {
                  const selected = BACK_PALETTES.find(
                    (option) => option.id === event.currentTarget.value,
                  )
                  if (selected) setPaletteId(selected.id)
                }}
              >
                {BACK_PALETTES.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="label cursor-pointer justify-start gap-2">
              <input
                className="checkbox checkbox-sm"
                type="checkbox"
                checked={border}
                onChange={(event) => setBorder(event.currentTarget.checked)}
              />
              <span className="label-text">Border</span>
            </label>
            <figure className="w-16 shrink-0">
              <img
                className="h-auto w-full rounded border border-base-300"
                src={generatedPreview}
                alt={`Preview of the ${selectedDesign.name} card back with the ${palette.name} palette.`}
                style={{ aspectRatio: `${cardSize.width} / ${cardSize.height}` }}
              />
            </figure>
          </div>
        ) : (
          <div className="space-y-4">
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
            <div className="flex flex-wrap gap-2">
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => imageInputRef.current?.click()}
              >
                Choose another image
              </button>
              <button
                className="btn btn-outline btn-error"
                type="button"
                disabled={!draftCard}
                onClick={clearDraft}
              >
                Remove image
              </button>
            </div>
            {draftCard?.backSrc && (
              <>
                <p className="text-sm text-base-content/70">
                  Choose the part of the image to print on the back of every card.
                </p>
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
      <button className="btn btn-primary" type="button" disabled={busy || missingImage} onClick={handleCreate}>
        Create standard deck
      </button>
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
