import { useEffect, useRef, useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import CardEditor from './components/CardEditor.tsx'
import CardFace from './components/CardFace.tsx'
import CalibrationDoc from './pdf/CalibrationDoc.tsx'
import DuplexDoc from './pdf/DuplexDoc.tsx'
import PrintAndGlueDoc from './pdf/PrintAndGlueDoc.tsx'
import {
  addCard,
  deleteCard,
  duplicateCard,
  quantityLabel,
  stepQuantity,
  totalCopies,
} from './lib/deck.ts'
import {
  calculateGrid,
  calculateTightGrid,
  CARD_PRESETS,
  DEFAULT_BLEED,
  mmToPt,
  PAPER,
  type Size,
} from './lib/geometry.ts'
import { cropAreaSize } from './lib/crop.ts'
import { centeredMaximumCrop, convertCropForBleedMode } from './lib/cropConvert.ts'
import {
  addCalibration,
  calibrationFromObserved,
  clampCalibration,
  loadCalibration,
  saveCalibration,
  type CalibrationMm,
} from './lib/calibration.ts'
import { hasBackground } from './lib/piece.ts'
import { loadImageSize, renderCrop } from './lib/renderCrop.ts'
import {
  layoutDuplexPages,
  layoutPrintAndGlue,
  type Calibration,
} from './lib/layout.ts'
import type { BleedMode, Card, CardSide, PixelCropRect } from './types.ts'

const SIDES: CardSide[] = ['front', 'back']
const PAPER_OPTIONS: (keyof typeof PAPER)[] = ['LETTER', 'A4']
const ZERO_CALIBRATION_MM: CalibrationMm = { offsetXmm: 0, offsetYmm: 0 }

type PaperName = keyof typeof PAPER
type PresetName = keyof typeof CARD_PRESETS
type ExportMode = 'PRINT_GLUE' | 'DUPLEX'
type QuantityDirection = -1 | 1

type QuantityStepperProps = {
  quantity: number
  cardLabel: string
  onStep: (direction: QuantityDirection) => void
}

function QuantityStepper({ quantity, cardLabel, onStep }: QuantityStepperProps) {
  return (
    <div className="join join-sm" role="group" aria-label={`${cardLabel} copy count`}>
      <button
        className="btn btn-xs join-item"
        type="button"
        aria-label={`Decrease ${cardLabel} copies`}
        title={`Decrease ${cardLabel} copies`}
        onClick={() => onStep(-1)}
      >
        −
      </button>
      <output
        className="join-item min-w-14 px-2 text-center text-xs"
        aria-label={quantityLabel(quantity)}
      >
        {quantityLabel(quantity)}
      </output>
      <button
        className="btn btn-xs join-item"
        type="button"
        aria-label={`Increase ${cardLabel} copies`}
        title={`Increase ${cardLabel} copies`}
        onClick={() => onStep(1)}
      >
        +
      </button>
    </div>
  )
}

function isPresetName(value: string): value is PresetName {
  return Object.prototype.hasOwnProperty.call(CARD_PRESETS, value)
}

function createCard(id: string, previous?: Card): Card {
  return {
    id,
    bleedMode: previous?.bleedMode ?? 'IMAGE',
    frontBackground: previous?.frontBackground ?? { enabled: false, color: '#ffffff' },
    backBackground: previous?.backBackground ?? { enabled: false, color: '#ffffff' },
    bleedColor: previous?.bleedColor ?? '#ffffff',
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

function sideSource(card: Card, side: CardSide): string | undefined {
  return side === 'front' ? card.frontSrc : card.backSrc
}

function sideCrop(card: Card, side: CardSide): PixelCropRect | undefined {
  return side === 'front' ? card.frontCrop : card.backCrop
}

function sideProcessedSource(card: Card, side: CardSide): string | undefined {
  return side === 'front' ? card.frontProcessedSrc : card.backProcessedSrc
}

function withSideCrop(
  card: Card,
  side: CardSide,
  crop: PixelCropRect | undefined,
  processedSource: string | undefined,
): Card {
  return side === 'front'
    ? { ...card, frontCrop: crop, frontProcessedSrc: processedSource }
    : { ...card, backCrop: crop, backProcessedSrc: processedSource }
}

async function prepareSideCrop(
  card: Card,
  side: CardSide,
  cardSize: Size,
  targetMode: BleedMode,
  convertExistingCrop: boolean,
): Promise<{ crop: PixelCropRect; blob: Blob } | undefined> {
  const source = sideSource(card, side)
  if (!source) return undefined

  const imageSize = await loadImageSize(source)
  const areaSize = cropAreaSize(cardSize, DEFAULT_BLEED, targetMode)
  const existingCrop = sideCrop(card, side)
  const crop =
    convertExistingCrop && existingCrop
      ? convertCropForBleedMode(
          existingCrop,
          imageSize,
          cardSize,
          DEFAULT_BLEED,
          card.bleedMode,
          targetMode,
        )
      : centeredMaximumCrop(imageSize, areaSize)

  return { crop, blob: await renderCrop(source, crop, areaSize) }
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
  const cardOperationTokens = useRef(new Map<string, number>())
  const presetGeneration = useRef(0)
  const presetInProgress = useRef(false)
  const appliedPreset = useRef<PresetName>('POKER')
  const [selectedId, setSelectedId] = useState('card-1')
  const [presetName, setPresetName] = useState<PresetName>('POKER')
  const [isChangingPreset, setIsChangingPreset] = useState(false)
  const [paperName, setPaperName] = useState<PaperName>('LETTER')
  const [exportMode, setExportMode] = useState<ExportMode>('PRINT_GLUE')
  const [calibration, setCalibration] = useState<CalibrationMm>(loadCalibration)
  const [calibrationDraft, setCalibrationDraft] = useState({
    offsetXmm: calibration.offsetXmm.toFixed(2),
    offsetYmm: calibration.offsetYmm.toFixed(2),
  })
  const [observedXmm, setObservedXmm] = useState('')
  const [observedYmm, setObservedYmm] = useState('')
  const [calibrationStorageWarning, setCalibrationStorageWarning] = useState<string>()
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string>()
  const [errors, setErrors] = useState<Record<CardSide, string | undefined>>({
    front: undefined,
    back: undefined,
  })

  const paper = PAPER[paperName]
  const cardSize = CARD_PRESETS[presetName]
  const grid = calculateGrid({ paper, card: cardSize, bleed: DEFAULT_BLEED })
  const tightGrid = calculateTightGrid({ paper, card: cardSize })
  const calibrationPt: Calibration = {
    offsetX: mmToPt(calibration.offsetXmm),
    offsetY: mmToPt(calibration.offsetYmm),
  }
  const selectedCard = cards.find((card) => card.id === selectedId)
  const pageCount =
    exportMode === 'PRINT_GLUE'
      ? layoutPrintAndGlue(cards, tightGrid).length
      : layoutDuplexPages(cards, grid, calibrationPt).length

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

  function handleQuantityStep(cardId: string, direction: QuantityDirection) {
    const currentCard = cardsRef.current.find((card) => card.id === cardId)
    if (!currentCard) return

    updateCard({
      ...currentCard,
      quantity: stepQuantity(currentCard.quantity, direction),
    })
  }

  function persistCalibration(nextCalibration: CalibrationMm) {
    const normalized = clampCalibration(nextCalibration)
    setCalibration(normalized)
    setCalibrationDraft({
      offsetXmm: normalized.offsetXmm.toFixed(2),
      offsetYmm: normalized.offsetYmm.toFixed(2),
    })
    setCalibrationStorageWarning(
      saveCalibration(normalized)
        ? undefined
        : 'Calibration changes could not be saved; reloading may lose them.',
    )
  }

  function commitCalibrationAxis(axis: keyof CalibrationMm) {
    const input = calibrationDraft[axis]
    const value = input.trim() === '' ? Number.NaN : Number(input)
    if (!Number.isFinite(value)) {
      setCalibrationDraft((current) => ({
        ...current,
        [axis]: calibration[axis].toFixed(2),
      }))
      return
    }
    persistCalibration({ ...calibration, [axis]: value })
  }

  function resetCalibration() {
    persistCalibration(ZERO_CALIBRATION_MM)
  }

  function applyObservedCorrection() {
    const currentCalibration = clampCalibration({
      offsetXmm:
        calibrationDraft.offsetXmm.trim() === ''
          ? calibration.offsetXmm
          : Number(calibrationDraft.offsetXmm),
      offsetYmm:
        calibrationDraft.offsetYmm.trim() === ''
          ? calibration.offsetYmm
          : Number(calibrationDraft.offsetYmm),
    })
    const observationX = Number(observedXmm)
    const observationY = Number(observedYmm)
    if (!Number.isFinite(observationX) || !Number.isFinite(observationY)) return

    const nextCalibration = clampCalibration(
      addCalibration(
        currentCalibration,
        calibrationFromObserved(observationX, observationY),
      ),
    )
    persistCalibration(nextCalibration)
    setObservedXmm('')
    setObservedYmm('')
  }

  function beginCardOperation(cardId: string): number {
    const token = (cardOperationTokens.current.get(cardId) ?? 0) + 1
    cardOperationTokens.current.set(cardId, token)
    return token
  }

  function isCurrentCardOperation(cardId: string, token: number): boolean {
    return cardOperationTokens.current.get(cardId) === token
  }

  function handleAddCard() {
    const card = createCard(crypto.randomUUID(), cardsRef.current.at(-1))
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
    const operationToken = beginCardOperation(currentCard.id)
    const presetForOperation = appliedPreset.current
    const nextSourceUrl = URL.createObjectURL(file)
    setErrors((current) => ({ ...current, [side]: undefined }))

    void (async () => {
      let nextProcessedUrl: string | undefined
      try {
        const imageSize = await loadImageSize(nextSourceUrl)
        const operationCardSize = CARD_PRESETS[presetForOperation]
        const areaSize = cropAreaSize(
          operationCardSize,
          DEFAULT_BLEED,
          currentCard.bleedMode,
        )
        const crop = centeredMaximumCrop(imageSize, areaSize)
        const blob = await renderCrop(nextSourceUrl, crop, areaSize)
        nextProcessedUrl = URL.createObjectURL(blob)

        const latestCard = cardsRef.current.find((card) => card.id === currentCard.id)
        if (
          !isCurrentCardOperation(currentCard.id, operationToken) ||
          appliedPreset.current !== presetForOperation ||
          !latestCard ||
          latestCard[sourceKey] !== currentCard[sourceKey]
        ) {
          URL.revokeObjectURL(nextSourceUrl)
          URL.revokeObjectURL(nextProcessedUrl)
          return
        }

        const nextCard = {
          ...latestCard,
          [sourceKey]: nextSourceUrl,
          [processedKey]: nextProcessedUrl,
          [cropKey]: crop,
        }
        const nextCards = cardsRef.current.map((card) =>
          card.id === latestCard.id ? nextCard : card,
        )
        replaceCards(nextCards)
        revokeUnusedUrls(
          [latestCard[sourceKey], latestCard[processedKey]].filter(
            (url): url is string => url !== undefined,
          ),
          nextCards,
        )
      } catch (error) {
        URL.revokeObjectURL(nextSourceUrl)
        if (nextProcessedUrl) URL.revokeObjectURL(nextProcessedUrl)
        if (isCurrentCardOperation(currentCard.id, operationToken)) {
          setErrors((current) => ({
            ...current,
            [side]: error instanceof Error
              ? error.message
              : 'Could not process this image.',
          }))
        }
      }
    })()
  }

  function handleImageRemove(side: CardSide) {
    const currentCard = cardsRef.current.find((card) => card.id === selectedId)
    if (!currentCard) return

    const sourceKey = side === 'front' ? 'frontSrc' : 'backSrc'
    const processedKey = side === 'front' ? 'frontProcessedSrc' : 'backProcessedSrc'
    const cropKey = side === 'front' ? 'frontCrop' : 'backCrop'
    beginCardOperation(currentCard.id)

    const nextCard = {
      ...currentCard,
      [sourceKey]: undefined,
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
    beginCardOperation(currentCard.id)
    const nextCard = { ...currentCard, [cropKey]: crop }
    const nextCards = cardsRef.current.map((card) =>
      card.id === currentCard.id ? nextCard : card,
    )
    replaceCards(nextCards)
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

  async function handlePresetChange(nextPreset: PresetName) {
    if (nextPreset === presetName || presetInProgress.current) return

    const generation = ++presetGeneration.current
    presetInProgress.current = true
    const originalCards = cardsRef.current
    const nextSize = CARD_PRESETS[nextPreset]
    const generatedUrls: string[] = []
    setIsChangingPreset(true)
    for (const card of originalCards) beginCardOperation(card.id)

    try {
      const nextCards = await Promise.all(
        originalCards.map(async (card) => {
          let nextCard = { ...card }
          for (const side of SIDES) {
            const result = await prepareSideCrop(
              card,
              side,
              nextSize,
              card.bleedMode,
              false,
            )
            const processedSource = result
              ? URL.createObjectURL(result.blob)
              : undefined
            if (processedSource) generatedUrls.push(processedSource)
            nextCard = withSideCrop(
              nextCard,
              side,
              result?.crop,
              processedSource,
            )
          }
          return nextCard
        }),
      )

      if (generation !== presetGeneration.current) {
        generatedUrls.forEach(URL.revokeObjectURL)
        return
      }
      if (cardsRef.current !== originalCards) {
        generatedUrls.forEach(URL.revokeObjectURL)
        setExportError('The deck changed while updating the preset. Please try again.')
        return
      }

      setPresetName(nextPreset)
      appliedPreset.current = nextPreset
      replaceCards(nextCards)
      revokeUnusedUrls(
        originalCards.flatMap((card) => [
          card.frontProcessedSrc,
          card.backProcessedSrc,
        ].filter((url): url is string => url !== undefined)),
        nextCards,
      )
      setExportError(undefined)
    } catch (error) {
      generatedUrls.forEach(URL.revokeObjectURL)
      setExportError(
        error instanceof Error
          ? `Could not update the preset: ${error.message}`
          : 'Could not update the preset.',
      )
    } finally {
      if (generation === presetGeneration.current) {
        presetInProgress.current = false
        setIsChangingPreset(false)
      }
    }
  }

  function handleBleedModeChange(cardId: string, nextBleedMode: BleedMode) {
    const sourceCard = cardsRef.current.find((card) => card.id === cardId)
    if (!sourceCard || sourceCard.bleedMode === nextBleedMode) return

    const operationToken = beginCardOperation(cardId)
    const presetForOperation = appliedPreset.current
    const operationCardSize = CARD_PRESETS[presetForOperation]
    const generatedUrls: string[] = []

    void (async () => {
      try {
        const processedSides = await Promise.all(
          SIDES.map(async (side) => {
            const result = await prepareSideCrop(
              sourceCard,
              side,
              operationCardSize,
              nextBleedMode,
              true,
            )
            const processedSource = result
              ? URL.createObjectURL(result.blob)
              : undefined
            if (processedSource) generatedUrls.push(processedSource)
            return { side, crop: result?.crop, processedSource }
          }),
        )

        const latestCard = cardsRef.current.find((card) => card.id === cardId)
        if (
          isCurrentCardOperation(cardId, operationToken) &&
          appliedPreset.current !== presetForOperation
        ) {
          generatedUrls.forEach(URL.revokeObjectURL)
          setExportError('The card preset changed during mode conversion. Please try again.')
          return
        }
        if (
          !isCurrentCardOperation(cardId, operationToken) ||
          !latestCard ||
          latestCard.bleedMode !== sourceCard.bleedMode ||
          SIDES.some(
            (side) => sideSource(latestCard, side) !== sideSource(sourceCard, side),
          )
        ) {
          generatedUrls.forEach(URL.revokeObjectURL)
          return
        }

        const nextCard = processedSides.reduce(
          (updated, sideResult) =>
            withSideCrop(
              updated,
              sideResult.side,
              sideResult.crop,
              sideResult.processedSource,
            ),
          { ...latestCard, bleedMode: nextBleedMode },
        )
        const nextCards = cardsRef.current.map((card) =>
          card.id === cardId ? nextCard : card,
        )
        replaceCards(nextCards)
        revokeUnusedUrls(
          SIDES.map((side) => sideProcessedSource(latestCard, side)).filter(
            (url): url is string => url !== undefined,
          ),
          nextCards,
        )
        setExportError(undefined)
      } catch (error) {
        generatedUrls.forEach(URL.revokeObjectURL)
        if (isCurrentCardOperation(cardId, operationToken)) {
          setExportError(
            error instanceof Error
              ? `Could not change bleed mode: ${error.message}`
              : 'Could not change bleed mode.',
          )
        }
      }
    })()
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
        exportMode === 'PRINT_GLUE' ? (
          <PrintAndGlueDoc
            cards={exportCards}
            paper={paper}
            grid={tightGrid}
            cardSize={cardSize}
          />
        ) : (
          <DuplexDoc
            cards={exportCards}
            paper={paper}
            grid={grid}
            cardSize={cardSize}
            calibration={calibrationPt}
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

  async function handleDownloadCalibrationSheet() {
    setIsExporting(true)
    setExportError(undefined)

    try {
      const pdfBlob = await pdf(
        <CalibrationDoc
          paper={paper}
          cardSize={cardSize}
          grid={grid}
          calibration={calibrationPt}
        />,
      ).toBlob()
      downloadPdfBlob(
        pdfBlob,
        `printboard-calibration-${paperName.toLowerCase()}.pdf`,
      )
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : 'Calibration sheet export failed. Please try again.',
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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <label className="form-control">
              <span className="label-text mb-1">Card preset</span>
              <select
                className="select select-bordered w-full"
                value={presetName}
                disabled={isChangingPreset}
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
                  setExportMode(
                    event.currentTarget.value === 'DUPLEX' ? 'DUPLEX' : 'PRINT_GLUE',
                  )
                }
              >
                <option value="PRINT_GLUE">Single-sided (print, cut, glue)</option>
                <option value="DUPLEX">Double-sided hand-cut</option>
              </select>
            </label>
          </div>
        </section>

        {exportMode === 'DUPLEX' && (
          <section className="mb-6 space-y-4 rounded-box border border-base-300 bg-base-100 p-5">
            <div>
              <h2 className="text-lg font-semibold">Calibration</h2>
              <p className="mt-2 text-sm text-base-content/70">
                1. Print the sheet at Actual Size (100%, no Fit to Page). 2. Flip the paper on its LONG edge and print page 2 on the back; the BACK arrow should end up at the top. 3. Hold the sheet up to a light. Look from the FRONT side. 4. Measure how far the square marks sit from the circle marks, and enter it below. 5. Press Apply correction, then print the sheet again to confirm.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="form-control">
                <span className="label-text mb-1">Current X offset (mm)</span>
                <input
                  className="input input-bordered w-full"
                  type="number"
                  min={-10}
                  max={10}
                  step={0.05}
                  value={calibrationDraft.offsetXmm}
                  onChange={(event) =>
                    setCalibrationDraft((current) => ({
                      ...current,
                      offsetXmm: event.currentTarget.value,
                    }))
                  }
                  onBlur={() => commitCalibrationAxis('offsetXmm')}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur()
                  }}
                />
              </label>
              <label className="form-control">
                <span className="label-text mb-1">Current Y offset (mm)</span>
                <input
                  className="input input-bordered w-full"
                  type="number"
                  min={-10}
                  max={10}
                  step={0.05}
                  value={calibrationDraft.offsetYmm}
                  onChange={(event) =>
                    setCalibrationDraft((current) => ({
                      ...current,
                      offsetYmm: event.currentTarget.value,
                    }))
                  }
                  onBlur={() => commitCalibrationAxis('offsetYmm')}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur()
                  }}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className="btn btn-outline"
                type="button"
                onClick={resetCalibration}
              >
                Reset to 0
              </button>
              <button
                className="btn btn-primary"
                type="button"
                disabled={isExporting}
                onClick={handleDownloadCalibrationSheet}
              >
                {isExporting ? 'Preparing calibration sheet…' : 'Download calibration sheet'}
              </button>
            </div>

            <fieldset className="space-y-3 rounded-box border border-base-300 p-4">
              <legend className="px-1 font-medium">Apply measured correction</legend>
              <label className="form-control gap-1">
                <span className="label-text">
                  Looking from the front, the back marks appear
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <input
                    className="input input-bordered w-28"
                    type="number"
                    step={0.05}
                    aria-label="Observed horizontal offset in millimetres"
                    value={observedXmm}
                    onChange={(event) => setObservedXmm(event.currentTarget.value)}
                  />
                  <span className="text-sm">
                    mm to the RIGHT of the front marks (negative = left)
                  </span>
                </span>
              </label>
              <label className="form-control gap-1">
                <span className="label-text">
                  Looking from the front, the back marks appear
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <input
                    className="input input-bordered w-28"
                    type="number"
                    step={0.05}
                    aria-label="Observed vertical offset in millimetres"
                    value={observedYmm}
                    onChange={(event) => setObservedYmm(event.currentTarget.value)}
                  />
                  <span className="text-sm">mm LOWER (negative = higher)</span>
                </span>
              </label>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={applyObservedCorrection}
              >
                Apply correction
              </button>
            </fieldset>

            <p className="text-sm text-base-content/70">
              Measure at two opposite corners. If they differ by more than 0.5 mm, your printer is scaling or skewing the page; enter the average and tell us.
            </p>
            {calibrationStorageWarning && (
              <p className="text-sm text-warning" role="status">
                {calibrationStorageWarning}
              </p>
            )}
          </section>
        )}

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
                  <span className="grid w-28 shrink-0 grid-cols-2 gap-1">
                    {SIDES.map((side) => (
                      <CardFace
                        key={side}
                        card={card}
                        side={side}
                        cardSize={cardSize}
                        showBleedRing={card.bleedMode === 'COLOR'}
                        source={side === 'front' ? card.frontProcessedSrc : card.backProcessedSrc}
                        placeholder={side === 'front' ? 'No front' : 'No back'}
                        alt={`Card ${index + 1} ${side} thumbnail`}
                      />
                    ))}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">Card {index + 1}</span>
                  </span>
                </button>
                <div className="mt-2 flex justify-end">
                  <QuantityStepper
                    quantity={card.quantity}
                    cardLabel={`Card ${index + 1}`}
                    onStep={(direction) => handleQuantityStep(card.id, direction)}
                  />
                </div>
                {(!card.frontProcessedSrc || !card.frontCrop) && (
                  <p className="mt-2 text-sm text-warning">
                    Front crop required; this card will be skipped during export.
                  </p>
                )}
                {(!card.backProcessedSrc || !card.backCrop) &&
                  !hasBackground(card, 'back') && (
                    <p className="mt-2 text-sm text-warning">
                      No back image or background; no back piece will be printed.
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
              errors={errors}
              onCardChange={updateCard}
              onBleedModeChange={handleBleedModeChange}
              onImageSelect={handleImageSelect}
              onImageRemove={handleImageRemove}
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
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-medium">Card {index + 1}</h3>
                    <QuantityStepper
                      quantity={card.quantity}
                      cardLabel={`Card ${index + 1}`}
                      onStep={(direction) => handleQuantityStep(card.id, direction)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {SIDES.map((side) => {
                      const source =
                        side === 'front' ? card.frontProcessedSrc : card.backProcessedSrc
                      return (
                        <div key={side}>
                          <p className="mb-1 text-xs capitalize text-base-content/60">{side}</p>
                          <CardFace
                            card={card}
                            side={side}
                            cardSize={cardSize}
                            showBleedRing={card.bleedMode === 'COLOR'}
                            source={source}
                            placeholder={side === 'front' ? 'Crop required' : 'No back'}
                            alt={`Card ${index + 1} ${side} print preview`}
                          />
                        </div>
                      )
                    })}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <footer className="mt-8 text-center text-xs text-base-content/50">
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://icons8.com/icon/A78RbSB5l7fM/cut"
          >
            Cut
          </a>{' '}
          icon by{' '}
          <a target="_blank" rel="noopener noreferrer" href="https://icons8.com">
            Icons8
          </a>
        </footer>
      </div>
    </main>
  )
}

export default App
