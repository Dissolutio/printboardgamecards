import { useEffect, useMemo, useState } from 'react'
import type { Size } from '../lib/geometry.ts'
import {
  BACK_DESIGNS,
  BACK_PALETTES,
  backSvgToDataUrl,
  generateBackSvg,
  type BackDesignId,
} from '../lib/backDesigns.ts'
import { backSvgSize } from '../lib/starterDeckBuild.ts'

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
    }

type StarterDeckPanelProps = {
  cardSize: Size
  disabled: boolean
  isLoadingManifest: boolean
  isProcessing: boolean
  progress?: { done: number; total: number }
  error?: string
  onCreate: (options: {
    includeJokers: boolean
    back: StarterBackChoice
  }) => void
}

export default function StarterDeckPanel({
  cardSize,
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
  const [imagePreview, setImagePreview] = useState<string>()
  const palette = BACK_PALETTES.find((option) => option.id === paletteId) ?? BACK_PALETTES[0]
  const selectedDesign = BACK_DESIGNS.find((option) => option.id === design) ?? BACK_DESIGNS[0]
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

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(undefined)
      return
    }

    const previewUrl = URL.createObjectURL(imageFile)
    setImagePreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [imageFile])

  function handleCreate() {
    if (backType === 'image') {
      if (imageFile) onCreate({ includeJokers, back: { type: 'image', file: imageFile } })
      return
    }
    onCreate({
      includeJokers,
      back: { type: 'design', design, paletteId, border },
    })
  }

  const busy = disabled || isLoadingManifest || isProcessing
  const missingImage = backType === 'image' && !imageFile

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
              onChange={() => setBackType('design')}
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
          <div className="flex flex-wrap items-end gap-4">
            <label className="form-control min-w-64 flex-1">
              <span className="label-text mb-1">Back image</span>
              <input
                className="file-input file-input-bordered w-full"
                type="file"
                accept={IMAGE_ACCEPT}
                onChange={(event) => setImageFile(event.currentTarget.files?.[0])}
              />
            </label>
            {imagePreview && (
              <figure className="w-16 shrink-0">
                <img
                  className="h-auto w-full rounded border border-base-300 object-contain"
                  src={imagePreview}
                  alt="Preview of the selected card back image."
                  style={{ aspectRatio: `${cardSize.width} / ${cardSize.height}` }}
                />
              </figure>
            )}
          </div>
        )}
      </fieldset>

      {missingImage && (
        <p className="text-sm text-base-content/70">Choose an image before you create the deck.</p>
      )}
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
