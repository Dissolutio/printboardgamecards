import { useEffect, useRef, useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import CardEditor from './components/CardEditor.tsx'
import DuplexDoc from './pdf/DuplexDoc.tsx'
import SingleSidedDoc from './pdf/SingleSidedDoc.tsx'
import { addCard, deleteCard, duplicateCard, totalCopies } from './lib/deck.ts'
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
import type { BleedMode, Card, CardSide, PixelCropRect } from './types.ts'

const SIDES: CardSide[] = ['front', 'back']
const PAPER_OPTIONS: (keyof typeof PAPER)[] = ['LETTER', 'A4']
const ZERO_CALIBRATION: Calibration = { offsetX: 0, offsetY: 0 }

type PaperName = keyof typeof PAPER
type PresetName = keyof typeof CARD_PRESETS
type ExportMode = 'SINGLE' | 'DUPLEX'

function isPresetName(value: string): value is PresetName {
  return Object.prototype.hasOwnProperty.call(CARD_PRESETS, value)
}

function createCard(id: string, backgroundColor = '#ffffff'): Card {
  return {
    id,
    backgroundColor,
    bleedColor: '#ffffff',
    quantity: 1,
  }
}

function objectUrls(card: Card): string[] {
  return [
    card.frontSrc,
    card.backSrc,
    card.frontProcessedSrc,
    card.backProcessedSrc,
  ].filter((url): url is string => url !== undefined && url.startsWith('blob:'))
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

function downloadPdfBlob(blob: Blob, filename: string) {
  const downloadUrl = URL.createObjectURL(blob)

  try {
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
  }
}

function App() {
  const [cards, setCards] = useState<Card[]>(() => [createCard('card-1')])
  const cardsRef = useRef(cards)
  const [selectedId, setSelectedId] = useState('card-1')
  const [presetName, setPresetName] = useState<PresetName>('POKER')
  const [bleedMode, setBleedMode] = useState<BleedMode>('IMAGE')
  const [paperName, setPaperName] = useState<PaperName>('LETTER')
  const [exportMode, setExportMode] = useState<ExportMode>('SINGLE')
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string>()
  const [errors, setErrors] = useState<Record<CardSide, string | undefined>>({
    front: undefined,
    back: undefined,
  })

  const paper = PAPER[paperName]
  const cardSize = CARD_PRESETS[presetName]
  const grid = calculateGrid({ paper, card: cardSize, bleed: DEFAULT_BLEED })
  const selectedCard = cards.find((card) => card.id === selectedId)
  const pageCount =
    exportMode === 'SINGLE'
      ? layoutPages(cards, grid).length
      : layoutDuplexPages(cards, grid, ZERO_CALIBRATION).length

  useEffect(
    () => () => {
      const urls = new Set(cardsRef.current.flatMap(objectUrls))
      for (const url of urls) URL.revokeObjectURL(url)
    },
    [],
  )

  function replaceCards(nextCards: Card[]) {
    cardsRef.current = nextCards
    setCards(nextCards)
  }

  function revokeUnusedUrls(candidates: string[], remainingCards: Card[]) {
    const retained = new Set(remainingCards.flatMap(objectUrls))
    for (const url of new Set(candidates)) {
      if (!retained.has(url)) URL.revokeObjectURL(url)
    }
  }

  function updateCard(nextCard: Card) {
    const currentCards = cardsRef.current
    const nextCards = currentCards.map((card) => (card.id === nextCard.id ? nextCard : card))
    replaceCards(nextCards)
  }

  function handleAddCard() {
    const previousCard = cardsRef.current.at(-1)
    const card = createCard(crypto.randomUUID(), previousCard?.backgroundColor)
    replaceCards(addCard(cardsRef.current, card))
    setSelectedId(card.id)
    setErrors({ front: undefined, back: undefined })
  }

  function handleDuplicateCard(cardId: string) {
    const duplicateId = crypto.randomUUID()
    const nextCards = duplicateCard(cardsRef.current, cardId, duplicateId)
    replaceCards(nextCards)
    setSelectedId(duplicateId)
    setErrors({ front: undefined, back: undefined })
  }

  function handleDeleteCard(cardId: string) {
    const currentCards = cardsRef.current
    const removedCard = currentCards.find((card) => card.id === cardId)
    const nextCards = deleteCard(currentCards, cardId)
    replaceCards(nextCards)
    if (removedCard) revokeUnusedUrls(objectUrls(removedCard), nextCards)

    if (selectedId === cardId) {
      setSelectedId(nextCards[0]?.id ?? '')
      setErrors({ front: undefined, back: undefined })
    }
  }

  function handleImageSelect(side: CardSide, file: File) {
    const currentCard = cardsRef.current.find((card) => card.id === selectedId)
    if (!currentCard) return

    const sourceKey = side === 'front' ? 'frontSrc' : 'backSrc'
    const processedKey = side === 'front' ? 'frontProcessedSrc' : 'backProcessedSrc'
    const cropKey = side === 'front' ? 'frontCrop' : 'backCrop'
    const nextSourceUrl = URL.createObjectURL(file)
    const nextCard = {
      ...currentCard,
      [sourceKey]: nextSourceUrl,
      [processedKey]: undefined,
      [cropKey]: undefined,
    }
    const nextCards = cardsRef.current.map((card) =>
      card.id === currentCard.id ? nextCard : card,
    )
    replaceCards(nextCards)
    revokeUnusedUrls(
      [currentCard[sourceKey], currentCard[processedKey]].filter(
        (url): url is string => url !== undefined,
      ),
      nextCards,
    )
    setErrors((current) => ({ ...current, [side]: undefined }))
  }

  function handleCropChange(side: CardSide, crop: PixelCropRect) {
    const currentCard = cardsRef.current.find((card) => card.id === selectedId)
    if (!currentCard) return

    const cropKey = side === 'front' ? 'frontCrop' : 'backCrop'
    const processedKey = side === 'front' ? 'frontProcessedSrc' : 'backProcessedSrc'
    const nextCard = { ...currentCard, [cropKey]: crop, [processedKey]: undefined }
    const nextCards = cardsRef.current.map((card) =>
      card.id === currentCard.id ? nextCard : card,
    )
    replaceCards(nextCards)
    revokeUnusedUrls(
      currentCard[processedKey] ? [currentCard[processedKey]] : [],
      nextCards,
    )
    setErrors((current) => ({ ...current, [side]: undefined }))
  }

  function handleProcessedImage(side: CardSide, blob: Blob) {
    const currentCard = cardsRef.current.find((card) => card.id === selectedId)
    if (!currentCard) return
    const sourceKey = side === 'front' ? 'frontSrc' : 'backSrc'
    const cropKey = side === 'front' ? 'frontCrop' : 'backCrop'
    const processedKey = side === 'front' ? 'frontProcessedSrc' : 'backProcessedSrc'
    if (!currentCard[sourceKey] || !currentCard[cropKey]) return

    const nextProcessedUrl = URL.createObjectURL(blob)
    const nextCard = { ...currentCard, [processedKey]: nextProcessedUrl }
    const nextCards = cardsRef.current.map((card) =>
      card.id === currentCard.id ? nextCard : card,
    )
    replaceCards(nextCards)
    revokeUnusedUrls(
      currentCard[processedKey] ? [currentCard[processedKey]] : [],
      nextCards,
    )
  }

  function handleError(side: CardSide, message: string | undefined) {
    setErrors((current) => ({ ...current, [side]: message }))
  }

  function invalidateDeckCrops() {
    const currentCards = cardsRef.current
    const processedUrls = currentCards.flatMap((card) => [
      card.frontProcessedSrc,
      card.backProcessedSrc,
    ].filter((url): url is string => url !== undefined))
    const nextCards = currentCards.map((card) => ({
      ...card,
      frontCrop: undefined,
      backCrop: undefined,
      frontProcessedSrc: undefined,
      backProcessedSrc: undefined,
    }))
    replaceCards(nextCards)
    revokeUnusedUrls(processedUrls, nextCards)
    setErrors({ front: undefined, back: undefined })
  }

  function handlePresetChange(nextPreset: PresetName) {
    if (nextPreset === presetName) return
    setPresetName(nextPreset)
    invalidateDeckCrops()
  }

  function handleBleedModeChange(nextBleedMode: BleedMode) {
    if (nextBleedMode === bleedMode) return
    setBleedMode(nextBleedMode)
    invalidateDeckCrops()
  }

  async function handleDownload() {
    if (pageCount === 0) {
      setExportError('Upload and crop a front image before exporting.')
      return
    }

    setIsExporting(true)
    setExportError(undefined)

    try {
      const exportCards = await Promise.all(
        cards.map(async (card) => {
          const [frontProcessedSrc, backProcessedSrc] = await Promise.all([
            card.frontProcessedSrc
              ? blobUrlToDataUrl(card.frontProcessedSrc)
              : undefined,
            card.backProcessedSrc
              ? blobUrlToDataUrl(card.backProcessedSrc)
              : undefined,
          ])
          return { ...card, frontProcessedSrc, backProcessedSrc }
        }),
      )
      const pdfDocument =
        exportMode === 'SINGLE' ? (
          <SingleSidedDoc
            cards={exportCards}
            paper={paper}
            grid={grid}
            cardSize={cardSize}
            bleedMode={bleedMode}
          />
        ) : (
          <DuplexDoc
            cards={exportCards}
            paper={paper}
            grid={grid}
            cardSize={cardSize}
            bleedMode={bleedMode}
            calibration={ZERO_CALIBRATION}
          />
        )
      const pdfBlob = await pdf(pdfDocument).toBlob()
      downloadPdfBlob(pdfBlob, `printboard-cards-${paperName.toLowerCase()}.pdf`)
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
            <h1 className="mt-1 text-3xl font-bold">Card deck editor</h1>
          </div>
          <p className="text-sm text-base-content/60">
            {paperName === 'LETTER' ? 'Letter' : 'A4'} paper · {paper.width} × {paper.height} pt
          </p>
        </header>

        <section className="mb-6 rounded-box border border-base-300 bg-base-100 p-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="form-control">
              <span className="label-text mb-1">Card preset</span>
              <select
                className="select select-bordered w-full"
                value={presetName}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  if (isPresetName(value)) handlePresetChange(value)
                }}
              >
                {Object.keys(CARD_PRESETS).map((name) => (
                  <option key={name} value={name}>
                    {name.charAt(0) + name.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-control">
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
            <label className="form-control">
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
            <fieldset>
              <legend className="mb-1 text-sm font-medium">Bleed mode</legend>
              <div className="join w-full">
                <button
                  className={`btn join-item flex-1 ${bleedMode === 'IMAGE' ? 'btn-primary' : 'btn-outline'}`}
                  type="button"
                  aria-pressed={bleedMode === 'IMAGE'}
                  onClick={() => handleBleedModeChange('IMAGE')}
                >
                  Extend image
                </button>
                <button
                  className={`btn join-item flex-1 ${bleedMode === 'COLOR' ? 'btn-primary' : 'btn-outline'}`}
                  type="button"
                  aria-pressed={bleedMode === 'COLOR'}
                  onClick={() => handleBleedModeChange('COLOR')}
                >
                  Solid color
                </button>
              </div>
            </fieldset>
          </div>
        </section>

        <section className="mb-6 rounded-box border border-base-300 bg-base-100 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Cards</h2>
            <button className="btn btn-outline btn-primary" type="button" onClick={handleAddCard}>
              + Add card
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card, index) => (
              <article
                key={card.id}
                className={`rounded-box border p-3 ${card.id === selectedId ? 'border-primary' : 'border-base-300'}`}
              >
                <button
                  className="flex w-full items-center gap-3 text-left"
                  type="button"
                  aria-pressed={card.id === selectedId}
                  onClick={() => {
                    setSelectedId(card.id)
                    setErrors({ front: undefined, back: undefined })
                  }}
                >
                  <span className="grid h-20 w-28 shrink-0 grid-cols-2 gap-1">
                    {(['front', 'back'] as const).map((side) => {
                      const source =
                        side === 'front' ? card.frontProcessedSrc : card.backProcessedSrc
                      return (
                        <span
                          key={side}
                          className="flex min-w-0 items-center justify-center overflow-hidden rounded"
                          style={{
                            backgroundColor:
                              bleedMode === 'COLOR' ? card.bleedColor : card.backgroundColor,
                            padding: bleedMode === 'COLOR' ? 3 : 0,
                          }}
                        >
                          {source ? (
                            <img
                              className="h-full w-full object-cover"
                              src={source}
                              alt={`Card ${index + 1} ${side} thumbnail`}
                              style={{ backgroundColor: card.backgroundColor }}
                            />
                          ) : (
                            <span className="px-1 text-center text-[10px] text-base-content/60">
                              No {side}
                            </span>
                          )}
                        </span>
                      )
                    })}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">Card {index + 1}</span>
                    <span className="block text-sm text-base-content/60">
                      {card.quantity} cop{card.quantity === 1 ? 'y' : 'ies'}
                    </span>
                  </span>
                </button>
                {(!card.frontProcessedSrc || !card.frontCrop) && (
                  <p className="mt-2 text-sm text-warning">
                    Front crop required; this card will be skipped during export.
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    className="btn btn-sm btn-outline flex-1"
                    type="button"
                    onClick={() => handleDuplicateCard(card.id)}
                  >
                    Duplicate
                  </button>
                  <button
                    className="btn btn-sm btn-outline btn-error flex-1"
                    type="button"
                    onClick={() => handleDeleteCard(card.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-box border border-base-300 bg-base-100 p-5">
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-sm text-base-content/60">
              {pageCount} {exportMode === 'DUPLEX' ? 'page pair' : 'page'}
              {pageCount === 1 ? '' : 's'} · {totalCopies(cards)} total copies
            </p>
            <button
              className="btn btn-primary"
              type="button"
              disabled={pageCount === 0 || isExporting}
              onClick={handleDownload}
            >
              {isExporting ? 'Preparing PDF…' : 'Download PDF'}
            </button>
          </div>
          <p className="max-w-2xl text-sm font-medium text-warning">
            {exportMode === 'DUPLEX'
              ? 'Print at Actual Size. Flip on Long Edge. If printing by hand: print page 1, reload the sheet flipped on its long edge, then print page 2.'
              : 'Print at Actual Size / 100% scale. Do not use Fit to Page.'}
          </p>
          {exportError && (
            <p role="alert" className="w-full text-sm text-error">
              {exportError}
            </p>
          )}
        </section>

        {selectedCard ? (
          <section className="mb-6">
            <h2 className="mb-3 text-xl font-semibold">Edit selected card</h2>
            <CardEditor
              key={selectedCard.id}
              card={selectedCard}
              cardSize={cardSize}
              bleedMode={bleedMode}
              errors={errors}
              onCardChange={updateCard}
              onImageSelect={handleImageSelect}
              onCropChange={handleCropChange}
              onProcessedImage={handleProcessedImage}
              onError={handleError}
            />
          </section>
        ) : (
          <p className="mb-6 rounded-box bg-base-100 p-6 text-center text-base-content/60">
            Add a card to start building your deck.
          </p>
        )}

        <section className="rounded-box border border-base-300 bg-base-100 p-5">
          <h2 className="mb-4 text-lg font-semibold">Print preview</h2>
          {cards.length === 0 ? (
            <p className="text-sm text-base-content/60">No cards in this deck.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((card, index) => (
                <article key={card.id} className="rounded-box border border-base-300 p-3">
                  <h3 className="mb-2 font-medium">Card {index + 1} · {card.quantity} copies</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {SIDES.map((side) => {
                      const source =
                        side === 'front' ? card.frontProcessedSrc : card.backProcessedSrc
                      return (
                        <div key={side}>
                          <p className="mb-1 text-xs capitalize text-base-content/60">{side}</p>
                          <div
                            className="flex h-36 items-center justify-center overflow-hidden rounded-box p-2"
                            style={{
                              backgroundColor:
                                bleedMode === 'COLOR' ? card.bleedColor : card.backgroundColor,
                            }}
                          >
                            {source ? (
                              <img
                                className="max-h-full max-w-full object-contain"
                                src={source}
                                alt={`Card ${index + 1} ${side} print preview`}
                                style={{
                                  backgroundColor: card.backgroundColor,
                                  border: bleedMode === 'COLOR' ? `3px solid ${card.bleedColor}` : undefined,
                                }}
                              />
                            ) : (
                              <span className="text-center text-xs text-base-content/50">
                                {side === 'front' ? 'Crop required' : 'Blank back'}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default App
