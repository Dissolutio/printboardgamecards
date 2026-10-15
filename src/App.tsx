import { useEffect, useRef, useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import CardEditor from './components/CardEditor.tsx'
import DuplexDoc from './pdf/DuplexDoc.tsx'
import SingleSidedDoc from './pdf/SingleSidedDoc.tsx'
import {
  calculateGrid,
  CARD_PRESETS,
  DEFAULT_BLEED,
  PAPER,
} from './lib/geometry.ts'
import {
  layoutDuplexPages,
  layoutPages,
  type Calibration,
} from './lib/layout.ts'
import type { Card, CardSide, PixelCropRect } from './types.ts'

const SIDES: CardSide[] = ['front', 'back']
const PAPER_OPTIONS: (keyof typeof PAPER)[] = ['LETTER', 'A4']
const ZERO_CALIBRATION: Calibration = { offsetX: 0, offsetY: 0 }

type SideState<T> = Record<CardSide, T>
type PaperName = keyof typeof PAPER
type ExportMode = 'SINGLE' | 'DUPLEX'

function createInitialCard(): Card {
  return {
    id: 'card-1',
    ...CARD_PRESETS.POKER,
    bleedMode: 'IMAGE',
    bleedColor: '#ffffff',
    quantity: 1,
  }
}

async function blobUrlToDataUrl(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Could not read the cropped image for PDF export.')

  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Could not convert the cropped image for PDF export.'))
      }
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('Could not convert the cropped image for PDF export.'))
    }
    reader.readAsDataURL(blob)
  })
}

function App() {
  const [card, setCard] = useState<Card>(createInitialCard)
  const [paperName, setPaperName] = useState<PaperName>('LETTER')
  const [exportMode, setExportMode] = useState<ExportMode>('SINGLE')
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string>()
  const [processedSources, setProcessedSources] = useState<SideState<string | undefined>>({
    front: undefined,
    back: undefined,
  })
  const [errors, setErrors] = useState<SideState<string | undefined>>({
    front: undefined,
    back: undefined,
  })
  const sourceUrls = useRef<SideState<string | undefined>>({
    front: undefined,
    back: undefined,
  })
  const processedUrls = useRef<SideState<string | undefined>>({
    front: undefined,
    back: undefined,
  })
  const paper = PAPER[paperName]
  const grid = calculateGrid({
    paper,
    card: { width: card.width, height: card.height },
    bleed: DEFAULT_BLEED,
  })
  const exportCards = processedSources.front
    ? [
        {
          ...card,
          frontSrc: processedSources.front,
          backSrc: processedSources.back,
          backCrop: processedSources.back ? card.backCrop : undefined,
        },
      ]
    : []
  const pageCount =
    exportMode === 'SINGLE'
      ? layoutPages(exportCards, grid).length
      : layoutDuplexPages(exportCards, grid, ZERO_CALIBRATION).length

  useEffect(
    () => () => {
      for (const side of SIDES) {
        const sourceUrl = sourceUrls.current[side]
        const processedUrl = processedUrls.current[side]
        if (sourceUrl) URL.revokeObjectURL(sourceUrl)
        if (processedUrl) URL.revokeObjectURL(processedUrl)
      }
    },
    [],
  )

  function clearProcessedSource(side: CardSide) {
    const previousUrl = processedUrls.current[side]
    if (previousUrl) URL.revokeObjectURL(previousUrl)
    processedUrls.current[side] = undefined
    setProcessedSources((current) => ({ ...current, [side]: undefined }))
  }

  function handleCardChange(nextCard: Card, resetCrops = false) {
    if (resetCrops) {
      for (const side of SIDES) clearProcessedSource(side)
    }
    setCard(nextCard)
  }

  function handleImageSelect(side: CardSide, file: File) {
    const sourceKey = side === 'front' ? 'frontSrc' : 'backSrc'
    const cropKey = side === 'front' ? 'frontCrop' : 'backCrop'
    const nextSourceUrl = URL.createObjectURL(file)
    const previousSourceUrl = sourceUrls.current[side]

    if (previousSourceUrl) URL.revokeObjectURL(previousSourceUrl)
    sourceUrls.current[side] = nextSourceUrl
    clearProcessedSource(side)
    setErrors((current) => ({ ...current, [side]: undefined }))
    setCard((current) => ({
      ...current,
      [sourceKey]: nextSourceUrl,
      [cropKey]: undefined,
    }))
  }

  function handleCropChange(side: CardSide, crop: PixelCropRect) {
    const cropKey = side === 'front' ? 'frontCrop' : 'backCrop'
    clearProcessedSource(side)
    setErrors((current) => ({ ...current, [side]: undefined }))
    setCard((current) => ({ ...current, [cropKey]: crop }))
  }

  function handleProcessedImage(side: CardSide, blob: Blob) {
    if (!sourceUrls.current[side]) return

    const nextProcessedUrl = URL.createObjectURL(blob)
    const previousProcessedUrl = processedUrls.current[side]
    if (previousProcessedUrl) URL.revokeObjectURL(previousProcessedUrl)
    processedUrls.current[side] = nextProcessedUrl
    setProcessedSources((current) => ({ ...current, [side]: nextProcessedUrl }))
  }

  function handleError(side: CardSide, message: string | undefined) {
    setErrors((current) => ({ ...current, [side]: message }))
  }

  async function handleDownload() {
    if (!processedSources.front) {
      setExportError('Upload and crop a front image before exporting.')
      return
    }

    setIsExporting(true)
    setExportError(undefined)

    try {
      const [frontDataUrl, backDataUrl] = await Promise.all([
        blobUrlToDataUrl(processedSources.front),
        processedSources.back ? blobUrlToDataUrl(processedSources.back) : undefined,
      ])
      const exportCard = {
        ...card,
        frontSrc: frontDataUrl,
        backSrc: backDataUrl,
        backCrop: backDataUrl ? card.backCrop : undefined,
      }
      const pdfDocument =
        exportMode === 'SINGLE' ? (
          <SingleSidedDoc cards={[exportCard]} paper={paper} grid={grid} />
        ) : (
          <DuplexDoc
            cards={[exportCard]}
            paper={paper}
            grid={grid}
            calibration={ZERO_CALIBRATION}
          />
        )
      const pdfBlob = await pdf(pdfDocument).toBlob()
      const downloadUrl = URL.createObjectURL(pdfBlob)

      try {
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = `printboard-cards-${paperName.toLowerCase()}.pdf`
        document.body.appendChild(link)
        link.click()
        link.remove()
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
      }
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'PDF export failed. Please try again.',
      )
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <main className="min-h-screen bg-base-200 px-4 py-8 text-base-content sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              Printboard Game Cards
            </p>
            <h1 className="mt-1 text-3xl font-bold">Card editor</h1>
          </div>
          <p className="text-sm text-base-content/60">
            {paperName === 'LETTER' ? 'Letter' : 'A4'} paper · {paper.width} × {paper.height} pt
          </p>
        </header>

        <section className="mb-6 flex flex-wrap items-end justify-between gap-4 rounded-box border border-base-300 bg-base-100 p-5">
          <label className="form-control w-40">
            <span className="label-text mb-1">Paper size</span>
            <select
              className="select select-bordered w-full"
              value={paperName}
              onChange={(event) => {
                const selectedPaper = PAPER_OPTIONS.find(
                  (option) => option === event.currentTarget.value,
                )
                if (selectedPaper) setPaperName(selectedPaper)
              }}
            >
              {PAPER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === 'LETTER' ? 'Letter' : 'A4'}
                </option>
              ))}
            </select>
          </label>
          <label className="form-control w-56">
            <span className="label-text mb-1">Print mode</span>
            <select
              className="select select-bordered w-full"
              value={exportMode}
              onChange={(event) =>
                setExportMode(event.currentTarget.value === 'DUPLEX' ? 'DUPLEX' : 'SINGLE')
              }
            >
              <option value="SINGLE">Single-sided</option>
              <option value="DUPLEX">Double-sided hand-cut</option>
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-sm text-base-content/60">
              {pageCount} {exportMode === 'DUPLEX' ? 'page pair' : 'page'}
              {pageCount === 1 ? '' : 's'} · {card.quantity} front
              {card.quantity === 1 ? '' : 's'}
            </p>
            <button
              className="btn btn-primary"
              type="button"
              disabled={!processedSources.front || isExporting}
              onClick={handleDownload}
            >
              {isExporting ? 'Preparing PDF…' : 'Download PDF'}
            </button>
            <p className="max-w-md text-sm font-medium text-warning">
              {exportMode === 'DUPLEX'
                ? 'Print at Actual Size. Flip on Long Edge. If printing by hand: print page 1, reload the sheet flipped on its long edge, then print page 2.'
                : 'Print at Actual Size / 100% scale. Do not use Fit to Page.'}
            </p>
          </div>
          {exportError && (
            <p role="alert" className="w-full text-sm text-error">
              {exportError}
            </p>
          )}
        </section>

        <CardEditor
          card={card}
          processedSources={processedSources}
          errors={errors}
          onCardChange={handleCardChange}
          onImageSelect={handleImageSelect}
          onCropChange={handleCropChange}
          onProcessedImage={handleProcessedImage}
          onError={handleError}
        />
      </div>
    </main>
  )
}

export default App
