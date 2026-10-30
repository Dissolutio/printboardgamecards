import { useEffect, useRef, useState, type ChangeEvent } from 'react'
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
  PAPER,
  type PieceOrientation,
  type Size,
} from './lib/geometry.ts'
import { cropAreaSize } from './lib/crop.ts'
import { centeredMaximumCrop, convertCropForBleedMode } from './lib/cropConvert.ts'
import {
  addCalibration,
  calibrationFromObserved,
  clampCalibration,
  type CalibrationMm,
} from './lib/calibration.ts'
import {
  addProfile,
  deleteProfile,
  duplexPdfFilename,
  exportCalibrationPt,
  hasCalibration,
  loadPrinterProfiles,
  renameProfile,
  savePrinterProfiles,
  selectProfile,
  updateActiveOffsets,
  type ExportKind,
  type PrinterProfiles,
} from './lib/printerProfiles.ts'
import { hasBackground } from './lib/piece.ts'
import { parseMeasurement } from './lib/calibrationInput.ts'
import {
  calibrationScaleY,
  estimatePrintScale,
  expectedScaleGapSpaces,
  SHEET_WIDTH_MM,
} from './lib/calibrationScale.ts'
import { getImageType } from './lib/imageType.ts'
import { loadImageSize, renderCrop } from './lib/renderCrop.ts'
import { parseProject, serializeProject } from './lib/project.ts'
import { findDisallowedSources } from './lib/sourcePolicy.ts'
import { isSvgFile, isSvgUrl } from './lib/vectorSource.ts'
import {
  convertProjectDataSourcesToBlobUrls,
  needsProjectReplacementConfirmation,
  PROJECT_FILENAME,
  validateProjectSettings,
} from './lib/projectIo.ts'
import {
  layoutDuplexPages,
  layoutPrintAndGlue,
} from './lib/layout.ts'
import type { BleedMode, Card, CardSide, PixelCropRect } from './types.ts'

const SIDES: CardSide[] = ['front', 'back']
const PAPER_OPTIONS: (keyof typeof PAPER)[] = ['LETTER', 'A4']
const ZERO_CALIBRATION_MM: CalibrationMm = { offsetXmm: 0, offsetYmm: 0 }
const calibrationNumberFormat = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const scaleGapFormat = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
})
const scalePercentFormat = new Intl.NumberFormat(undefined, {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

type PaperName = keyof typeof PAPER
type PresetName = keyof typeof CARD_PRESETS
type ExportMode = 'PRINT_GLUE' | 'DUPLEX'
type QuantityDirection = -1 | 1

function expectedScaleTotalMessage(value: number): string {
  return `The expected total is ${scaleGapFormat.format(value)}.`
}

function estimatedScaleMessage(value: number): string {
  return `Estimated printer scale is ${scalePercentFormat.format(value)}.`
}

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
  if (!response.ok) throw new Error('Could not read image data.')

  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Could not convert image data.'))
      }
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('Could not convert image data.'))
    }
    reader.readAsDataURL(blob)
  })
}

async function dataUrlToBlobUrl(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Could not read an image from the project file.')
  return URL.createObjectURL(await response.blob())
}

function downloadBlob(blob: Blob, filename: string) {
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
  const projectOperationInProgress = useRef(false)
  const appliedPreset = useRef<PresetName>('POKER')
  const projectFileInput = useRef<HTMLInputElement>(null)
  const [selectedId, setSelectedId] = useState('card-1')
  const [presetName, setPresetName] = useState<PresetName>('POKER')
  const [isChangingPreset, setIsChangingPreset] = useState(false)
  const [isSavingProject, setIsSavingProject] = useState(false)
  const [isLoadingProject, setIsLoadingProject] = useState(false)
  const [paperName, setPaperName] = useState<PaperName>('LETTER')
  const [exportMode, setExportMode] = useState<ExportMode>('PRINT_GLUE')
  const [pieceOrientation, setPieceOrientation] = useState<PieceOrientation>('AUTO')
  const [printerProfiles, setPrinterProfiles] =
    useState<PrinterProfiles>(loadPrinterProfiles)
  const activeProfile =
    printerProfiles.profiles.find(({ id }) => id === printerProfiles.activeId) ??
    printerProfiles.profiles[0]
  const [calibrationDraft, setCalibrationDraft] = useState({
    offsetXmm: activeProfile.offsetXmm.toFixed(2),
    offsetYmm: activeProfile.offsetYmm.toFixed(2),
  })
  const [observedXmm, setObservedXmm] = useState('')
  const [observedYmm, setObservedYmm] = useState('')
  const [scaleGapInput, setScaleGapInput] = useState('')
  const [calibrationUpdated, setCalibrationUpdated] = useState(false)
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
  const tightGrid = calculateTightGrid({
    paper,
    card: cardSize,
    orientation: pieceOrientation,
  })
  const calibrationPt = exportCalibrationPt('CALIBRATED', activeProfile)
  const hasCalibrationScale =
    calibrationScaleY({ paper, grid, cardSize, backOffsetY: calibrationPt.offsetY }) !== null
  const scaleGapValue = parseMeasurement(scaleGapInput)
  const validScaleGap = scaleGapValue !== undefined && scaleGapValue >= 0
  const scaleEstimate =
    scaleGapValue !== undefined && scaleGapValue >= 0
      ? estimatePrintScale({
          sheetWidthMm: SHEET_WIDTH_MM[paperName],
          gapSpaces: scaleGapValue,
        })
      : undefined
  const selectedCard = cards.find((card) => card.id === selectedId)
  const isProjectControlsDisabled =
    isChangingPreset || isSavingProject || isLoadingProject || isExporting
  const pageCount =
    exportMode === 'PRINT_GLUE'
      ? layoutPrintAndGlue(cards, tightGrid).length
      : layoutDuplexPages(cards, grid, exportCalibrationPt('ORIGINAL', activeProfile)).length
  const calibratedDownloadNeedsOffsets =
    pageCount > 0 && !hasCalibration(activeProfile) && !isProjectControlsDisabled

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
      if (url.startsWith('blob:') && !retained.has(url)) URL.revokeObjectURL(url)
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

  function persistPrinterProfiles(nextProfiles: PrinterProfiles) {
    setPrinterProfiles(nextProfiles)
    setCalibrationStorageWarning(
      savePrinterProfiles(nextProfiles)
        ? undefined
        : 'Calibration changes could not be saved; reloading may lose them.',
    )
  }

  function syncCalibrationDraft(profile: PrinterProfiles['profiles'][number]) {
    setCalibrationDraft({
      offsetXmm: profile.offsetXmm.toFixed(2),
      offsetYmm: profile.offsetYmm.toFixed(2),
    })
  }

  function persistActiveCalibration(nextCalibration: CalibrationMm) {
    const nextProfiles = updateActiveOffsets(printerProfiles, nextCalibration)
    const nextProfile =
      nextProfiles.profiles.find(({ id }) => id === nextProfiles.activeId) ??
      nextProfiles.profiles[0]
    persistPrinterProfiles(nextProfiles)
    syncCalibrationDraft(nextProfile)
  }

  function commitCalibrationAxis(axis: keyof CalibrationMm) {
    const input = calibrationDraft[axis]
    const value = input.trim() === '' ? Number.NaN : Number(input)
    if (!Number.isFinite(value)) {
      setCalibrationDraft((current) => ({
        ...current,
        [axis]: activeProfile[axis].toFixed(2),
      }))
      return
    }
    persistActiveCalibration({ ...activeProfile, [axis]: value })
  }

  function resetCalibration() {
    persistActiveCalibration(ZERO_CALIBRATION_MM)
    setCalibrationUpdated(false)
  }

  function applyObservedCorrection() {
    const currentCalibration = clampCalibration({
      offsetXmm:
        calibrationDraft.offsetXmm.trim() === ''
          ? activeProfile.offsetXmm
          : Number(calibrationDraft.offsetXmm),
      offsetYmm:
        calibrationDraft.offsetYmm.trim() === ''
          ? activeProfile.offsetYmm
          : Number(calibrationDraft.offsetYmm),
    })
    const observationX = parseMeasurement(observedXmm)
    const observationY = parseMeasurement(observedYmm)
    if (observationX === undefined || observationY === undefined) return

    const nextCalibration = clampCalibration(
      addCalibration(
        currentCalibration,
        calibrationFromObserved(observationX, observationY),
      ),
    )
    persistActiveCalibration(nextCalibration)
    setObservedXmm('')
    setObservedYmm('')
    setCalibrationUpdated(true)
  }

  function handleSelectPrinter(id: string) {
    const nextProfiles = selectProfile(printerProfiles, id)
    const nextProfile =
      nextProfiles.profiles.find(({ id: profileId }) => profileId === nextProfiles.activeId) ??
      nextProfiles.profiles[0]
    persistPrinterProfiles(nextProfiles)
    syncCalibrationDraft(nextProfile)
    setCalibrationUpdated(false)
  }

  function handleAddPrinter() {
    const name = window.prompt('New printer name', `Printer ${printerProfiles.profiles.length + 1}`)
    if (name === null) return
    const nextProfiles = addProfile(printerProfiles, name)
    if (nextProfiles === printerProfiles) return
    persistPrinterProfiles(nextProfiles)
    syncCalibrationDraft(nextProfiles.profiles[nextProfiles.profiles.length - 1])
    setCalibrationUpdated(false)
  }

  function handleRenamePrinter() {
    const name = window.prompt('Rename printer', activeProfile.name)
    if (name === null) return
    persistPrinterProfiles(renameProfile(printerProfiles, activeProfile.id, name))
  }

  function handleDeletePrinter() {
    if (
      !window.confirm(
        `Delete "${activeProfile.name}" (X ${activeProfile.offsetXmm >= 0 ? '+' : ''}${activeProfile.offsetXmm.toFixed(2)} mm, Y ${activeProfile.offsetYmm >= 0 ? '+' : ''}${activeProfile.offsetYmm.toFixed(2)} mm)? This cannot be undone.`,
      )
    ) {
      return
    }

    const nextProfiles = deleteProfile(printerProfiles, activeProfile.id)
    const nextProfile =
      nextProfiles.profiles.find(({ id }) => id === nextProfiles.activeId) ??
      nextProfiles.profiles[0]
    persistPrinterProfiles(nextProfiles)
    syncCalibrationDraft(nextProfile)
    setCalibrationUpdated(false)
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
    const vectorKey = side === 'front' ? 'frontIsVector' : 'backIsVector'
    const processedKey = side === 'front' ? 'frontProcessedSrc' : 'backProcessedSrc'
    const cropKey = side === 'front' ? 'frontCrop' : 'backCrop'
    const operationToken = beginCardOperation(currentCard.id)
    const presetForOperation = appliedPreset.current
    const type = getImageType(file)
    const sourceFile =
      (!file.type || file.type.toLowerCase() === 'application/octet-stream') && type
        ? new Blob([file], { type })
        : file
    const nextSourceUrl = URL.createObjectURL(sourceFile)
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
          [vectorKey]: isSvgFile(file),
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
    const vectorKey = side === 'front' ? 'frontIsVector' : 'backIsVector'
    const processedKey = side === 'front' ? 'frontProcessedSrc' : 'backProcessedSrc'
    const cropKey = side === 'front' ? 'frontCrop' : 'backCrop'
    beginCardOperation(currentCard.id)

    const nextCard = {
      ...currentCard,
      [sourceKey]: undefined,
      [vectorKey]: false,
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
    if (
      nextPreset === presetName ||
      presetInProgress.current ||
      projectOperationInProgress.current ||
      isExporting
    ) {
      return
    }

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

  async function handleSaveProject() {
    if (
      projectOperationInProgress.current ||
      presetInProgress.current ||
      isExporting
    ) {
      return
    }

    projectOperationInProgress.current = true
    setIsSavingProject(true)
    setExportError(undefined)
    try {
      const currentCards = cardsRef.current
      const projectCards = await Promise.all(
        currentCards.map(async (card) => ({
          ...card,
          frontSrc: card.frontSrc?.startsWith('blob:')
            ? await blobUrlToDataUrl(card.frontSrc)
            : card.frontSrc,
          backSrc: card.backSrc?.startsWith('blob:')
            ? await blobUrlToDataUrl(card.backSrc)
            : card.backSrc,
          frontProcessedSrc: undefined,
          backProcessedSrc: undefined,
        })),
      )
      const projectSettings = {
        presetName,
        paperName,
        exportMode,
        pieceOrientation,
      }
      const projectBlob = new Blob(
        [serializeProject(projectSettings, projectCards)],
        { type: 'application/json' },
      )
      downloadBlob(projectBlob, PROJECT_FILENAME)
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : 'Could not save the project. Please try again.',
      )
    } finally {
      projectOperationInProgress.current = false
      setIsSavingProject(false)
    }
  }

  async function handleLoadProject(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) {
      input.value = ''
      return
    }
    if (projectOperationInProgress.current || presetInProgress.current || isExporting) {
      setExportError('Finish the current operation before loading a project.')
      input.value = ''
      return
    }

    projectOperationInProgress.current = true
    setIsLoadingProject(true)
    setExportError(undefined)
    const generatedUrls: string[] = []
    let generation: number | undefined
    let ownsPresetLock = false
    try {
      const parsed = parseProject(await file.text())
      if (!parsed.ok) {
        setExportError(parsed.error)
        return
      }

      const disallowedSource = findDisallowedSources(
        parsed.cards,
        `${import.meta.env.BASE_URL}decks/`,
      )
      if (disallowedSource) {
        setExportError(disallowedSource)
        return
      }

      const validatedSettings = validateProjectSettings(
        parsed.project.settings,
        isPresetName,
      )
      if (!validatedSettings.ok) {
        setExportError(validatedSettings.error)
        return
      }
      const nextSettings = validatedSettings.settings
      if (
        needsProjectReplacementConfirmation(cardsRef.current, {
          presetName,
          paperName,
          exportMode,
          pieceOrientation,
        }) &&
        !window.confirm('Replace the current deck?')
      ) {
        return
      }

      generation = ++presetGeneration.current
      presetInProgress.current = true
      ownsPresetLock = true
      setIsChangingPreset(true)
      const originalCards = cardsRef.current
      const nextSize = CARD_PRESETS[nextSettings.presetName]
      for (const card of originalCards) beginCardOperation(card.id)

      const cardsWithVectorFlags = parsed.cards.map((card) => ({
        ...card,
        ...(card.frontSrc !== undefined && { frontIsVector: isSvgUrl(card.frontSrc) }),
        ...(card.backSrc !== undefined && { backIsVector: isSvgUrl(card.backSrc) }),
      }))
      const convertedCards = await convertProjectDataSourcesToBlobUrls(
        cardsWithVectorFlags,
        dataUrlToBlobUrl,
        (url) => generatedUrls.push(url),
      )
      const nextCards: Card[] = []
      for (const card of convertedCards) {
        let nextCard = card
        for (const side of SIDES) {
          if (!sideSource(card, side) || !sideCrop(card, side)) continue
          const result = await prepareSideCrop(
            card,
            side,
            nextSize,
            card.bleedMode,
            true,
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
        nextCards.push(nextCard)
      }

      if (
        generation !== presetGeneration.current ||
        cardsRef.current !== originalCards
      ) {
        generatedUrls.forEach(URL.revokeObjectURL)
        if (cardsRef.current !== originalCards) {
          setExportError('The deck changed while loading the project. Please try again.')
        }
        return
      }

      const cardsToApply = nextCards.length > 0 ? nextCards : [createCard(crypto.randomUUID())]
      for (const card of originalCards) beginCardOperation(card.id)
      setPresetName(nextSettings.presetName)
      setPaperName(nextSettings.paperName)
      setExportMode(nextSettings.exportMode)
      setPieceOrientation(nextSettings.pieceOrientation)
      appliedPreset.current = nextSettings.presetName
      replaceCards(cardsToApply)
      setSelectedId(cardsToApply[0].id)
      setErrors({ front: undefined, back: undefined })
      revokeUnusedUrls(originalCards.flatMap(objectUrls), cardsToApply)
    } catch (error) {
      generatedUrls.forEach(URL.revokeObjectURL)
      setExportError(
        error instanceof Error
          ? `Could not load the project: ${error.message}`
          : 'Could not load the project. Please try again.',
      )
    } finally {
      if (ownsPresetLock && generation === presetGeneration.current) {
        presetInProgress.current = false
        setIsChangingPreset(false)
      }
      projectOperationInProgress.current = false
      setIsLoadingProject(false)
      input.value = ''
    }
  }

  async function getExportCards() {
    return Promise.all(
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
  }

  async function handleDownloadDuplex(kind: ExportKind) {
    if (presetInProgress.current || projectOperationInProgress.current) return
    if (pageCount === 0) {
      setExportError('Upload and crop a front image before exporting.')
      return
    }

    setIsExporting(true)
    setExportError(undefined)

    try {
      const exportCards = await getExportCards()
      const pdfBlob = await pdf(
        <DuplexDoc
          cards={exportCards}
          paper={paper}
          grid={grid}
          cardSize={cardSize}
          calibration={exportCalibrationPt(kind, activeProfile)}
        />,
      ).toBlob()
      downloadBlob(
        pdfBlob,
        duplexPdfFilename(kind, paperName, activeProfile.name),
      )
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'PDF export failed. Please try again.',
      )
    } finally {
      setIsExporting(false)
    }
  }

  async function handleDownload() {
    if (presetInProgress.current || projectOperationInProgress.current) return
    if (pageCount === 0) {
      setExportError('Upload and crop a front image before exporting.')
      return
    }

    setIsExporting(true)
    setExportError(undefined)

    try {
      const exportCards = await getExportCards()
      const pdfBlob = await pdf(
        <PrintAndGlueDoc
          cards={exportCards}
          paper={paper}
          grid={tightGrid}
          cardSize={cardSize}
        />,
      ).toBlob()
      downloadBlob(pdfBlob, `printboard-cards-${paperName.toLowerCase()}.pdf`)
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'PDF export failed. Please try again.',
      )
    } finally {
      setIsExporting(false)
    }
  }

  async function handleDownloadCalibrationSheet() {
    if (presetInProgress.current || projectOperationInProgress.current) return
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
      downloadBlob(
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
                disabled={isProjectControlsDisabled}
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
                disabled={isLoadingProject}
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
                disabled={isLoadingProject}
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
            {exportMode === 'PRINT_GLUE' && (
              <label className="form-control">
                <span className="label-text mb-1">Piece orientation</span>
                <select
                  className="select select-bordered w-full"
                  value={pieceOrientation}
                  disabled={isLoadingProject}
                  onChange={(event) =>
                    setPieceOrientation(
                      event.currentTarget.value === 'UPRIGHT' ||
                        event.currentTarget.value === 'ROTATED'
                        ? event.currentTarget.value
                        : 'AUTO',
                    )
                  }
                >
                  <option value="AUTO">Auto</option>
                  <option value="UPRIGHT">Upright</option>
                  <option value="ROTATED">Rotated</option>
                </select>
              </label>
            )}
          </div>
        </section>

        {exportMode === 'DUPLEX' && (
          <section className="mb-6 space-y-4 rounded-box border border-base-300 bg-base-100 p-5">
            <div>
              <h2 className="text-lg font-semibold">Calibration</h2>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="form-control min-w-56 flex-1 sm:max-w-sm">
                <span className="label-text mb-1">Printer profile</span>
                <select
                  className="select select-bordered"
                  value={activeProfile.id}
                  disabled={isProjectControlsDisabled}
                  onChange={(event) => handleSelectPrinter(event.currentTarget.value)}
                >
                  {printerProfiles.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn btn-outline"
                type="button"
                disabled={printerProfiles.profiles.length >= 10 || isProjectControlsDisabled}
                onClick={handleAddPrinter}
              >
                New printer
              </button>
              <button
                className="btn btn-outline"
                type="button"
                disabled={isProjectControlsDisabled}
                onClick={handleRenamePrinter}
              >
                Rename
              </button>
              <button
                className="btn btn-outline btn-error"
                type="button"
                disabled={printerProfiles.profiles.length <= 1 || isProjectControlsDisabled}
                onClick={handleDeletePrinter}
              >
                Delete
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-start gap-3">
              <p>
                Current offset: X {calibrationNumberFormat.format(activeProfile.offsetXmm)} mm, Y{' '}
                {calibrationNumberFormat.format(activeProfile.offsetYmm)} mm
              </p>
              <button
                className="btn btn-outline"
                type="button"
                onClick={resetCalibration}
              >
                Reset to 0
              </button>
            </div>

            <ol className="list-decimal space-y-4 pl-5">
              <li>
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={isProjectControlsDisabled}
                  onClick={handleDownloadCalibrationSheet}
                >
                  {isExporting ? 'Preparing calibration sheet…' : 'Download calibration sheet'}
                </button>
              </li>
              <li className="space-y-1">
                <p>Print at Actual Size. Do not use Fit to Page.</p>
                <p>Flip the paper on the long edge to print the back.</p>
                <p>Place the back arrow at the top of the page.</p>
                <p>Hold the sheet up to a light. Look from the front side.</p>
                <p>
                  Look at one corner mark. The circle is the front mark. The square is the back mark.
                </p>
                <p>The front mark has a scale in millimeters in two directions.</p>
                <p>
                  The longest tick marks zero. Each longer tick after zero marks one millimeter. The
                  numbers 5 and -5 mark the ends.
                </p>
                <p>
                  Find where the vertical line of the back mark crosses the horizontal scale. Count
                  the longer ticks from zero.
                </p>
                <p>
                  If the line falls between two longer ticks, estimate the part of a millimeter.
                </p>
                <p>
                  Find where the horizontal line of the back mark crosses the vertical scale. Count
                  the same way.
                </p>
                <p>
                  Positive numbers are to the right and downward. Negative numbers are to the left
                  and upward.
                </p>
                <p>
                  Read two opposite corners. If the readings differ by more than 0.5 mm, enter the
                  average.
                </p>
              </li>
            </ol>
            {hasCalibrationScale ? (
              <ol start={3} className="list-decimal space-y-4 pl-5">
                <li className="space-y-1">
                  <h3 className="font-medium">Check the printer scaling</h3>
                  <p>Look at the long scale at the top or bottom of the front page.</p>
                  <p>
                    Count the empty spaces between the last tick and the paper edge on the left. Do
                    the same on the right.
                  </p>
                  <p>Enter the total of both counts.</p>
                  <label className="form-control max-w-sm gap-1">
                    <span className="label-text">Total of both counts</span>
                    <input
                      className="input input-bordered w-full"
                      type="number"
                      min={0}
                      step="any"
                      aria-label="Total of both counts"
                      aria-describedby="scale-gap-hint"
                      aria-invalid={
                        scaleGapInput.trim() !== '' && !validScaleGap
                      }
                      value={scaleGapInput}
                      onChange={(event) => setScaleGapInput(event.currentTarget.value)}
                    />
                    <span id="scale-gap-hint" className="text-sm">
                      {expectedScaleTotalMessage(
                        expectedScaleGapSpaces(SHEET_WIDTH_MM[paperName]),
                      )}
                    </span>
                    {scaleGapInput.trim() !== '' && !validScaleGap && (
                      <span className="text-sm text-error">Enter a number.</span>
                    )}
                  </label>
                  {scaleEstimate && (
                    <div className="space-y-1" role="status" aria-live="polite">
                      <p>
                        {scaleEstimate.verdict === 'OK'
                          ? 'The printer scale is close to 100 percent.'
                          : scaleEstimate.verdict === 'TOO_SMALL'
                            ? 'The printer made the page smaller. Print again at Actual Size and do not use Fit to Page.'
                            : 'The printer made the page larger. Print again at Actual Size and do not use Fit to Page.'}
                      </p>
                      <p>{estimatedScaleMessage(scaleEstimate.scale)}</p>
                    </div>
                  )}
                </li>
              </ol>
            ) : (
              <p>This card size has no long scale on the calibration sheet.</p>
            )}
            <ol
              start={hasCalibrationScale ? 4 : 3}
              className="list-decimal space-y-4 pl-5"
            >
              <li>
                <fieldset className="space-y-3 rounded-box border border-base-300 p-4">
                  <legend className="px-1 font-medium">Enter the measured distances.</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="form-control gap-1">
                      <span className="label-text">
                        Horizontal reading on the printed scale (mm)
                      </span>
                      <input
                        className="input input-bordered w-full"
                        type="number"
                        step={0.05}
                        aria-label="Horizontal reading on the printed scale (mm)"
                        aria-invalid={
                          observedXmm.trim() !== '' && parseMeasurement(observedXmm) === undefined
                        }
                        aria-describedby="observed-x-hint"
                        value={observedXmm}
                        onChange={(event) => {
                          setObservedXmm(event.currentTarget.value)
                          setCalibrationUpdated(false)
                        }}
                      />
                      <span id="observed-x-hint" className="text-sm">
                        Enter a positive number if the back mark is to the right of the front mark.
                        Enter a negative number if it is to the left.
                      </span>
                      {observedXmm.trim() !== '' &&
                        parseMeasurement(observedXmm) === undefined && (
                          <span className="text-sm text-error">Enter a number.</span>
                        )}
                    </label>
                    <label className="form-control gap-1">
                      <span className="label-text">
                        Vertical reading on the printed scale (mm)
                      </span>
                      <input
                        className="input input-bordered w-full"
                        type="number"
                        step={0.05}
                        aria-label="Vertical reading on the printed scale (mm)"
                        aria-invalid={
                          observedYmm.trim() !== '' && parseMeasurement(observedYmm) === undefined
                        }
                        aria-describedby="observed-y-hint"
                        value={observedYmm}
                        onChange={(event) => {
                          setObservedYmm(event.currentTarget.value)
                          setCalibrationUpdated(false)
                        }}
                      />
                      <span id="observed-y-hint" className="text-sm">
                        Enter a positive number if the back mark is lower than the front mark.
                        Enter a negative number if it is higher.
                      </span>
                      {observedYmm.trim() !== '' &&
                        parseMeasurement(observedYmm) === undefined && (
                          <span className="text-sm text-error">Enter a number.</span>
                        )}
                    </label>
                  </div>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    disabled={
                      parseMeasurement(observedXmm) === undefined ||
                      parseMeasurement(observedYmm) === undefined ||
                      isProjectControlsDisabled
                    }
                    onClick={applyObservedCorrection}
                  >
                    Apply correction
                  </button>
                </fieldset>
              </li>
            </ol>
            {calibrationUpdated && (
              <p className="text-sm text-success" role="status">
                The offset was updated. Print a new calibration sheet to check the result.
              </p>
            )}
            <details>
              <summary className="cursor-pointer">Edit offsets directly</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="form-control">
                  <span className="label-text mb-1">Current X offset (mm)</span>
                  <input
                    className="input input-bordered w-full"
                    type="number"
                    min={-10}
                    max={10}
                    step={0.05}
                    value={calibrationDraft.offsetXmm}
                    onChange={(event) => {
                      const value = event.currentTarget.value
                      setCalibrationDraft((current) => ({
                        ...current,
                        offsetXmm: value,
                      }))
                      setCalibrationUpdated(false)
                    }}
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
                    onChange={(event) => {
                      const value = event.currentTarget.value
                      setCalibrationDraft((current) => ({
                        ...current,
                        offsetYmm: value,
                      }))
                      setCalibrationUpdated(false)
                    }}
                    onBlur={() => commitCalibrationAxis('offsetYmm')}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur()
                    }}
                  />
                </label>
              </div>
            </details>
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
                  {!card.frontSrc ? (
                    <p className="mt-2 text-sm text-warning">
                      This card has no front image. It will be skipped during export.
                    </p>
                  ) : (!card.frontProcessedSrc || !card.frontCrop) && (
                    <p className="mt-2 text-sm text-warning">
                      Front crop required; this card will be skipped during export.
                    </p>
                  )}
                  {!card.backSrc && !hasBackground(card, 'back') && (
                    <p className="mt-2 text-sm text-warning">
                      This card has no back image and no back background. No back will be printed.
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
            {exportMode === 'PRINT_GLUE' ? (
              <button
                className="btn btn-primary"
                type="button"
                disabled={pageCount === 0 || isProjectControlsDisabled}
                onClick={handleDownload}
              >
                {isExporting ? 'Preparing PDF…' : 'Download PDF'}
              </button>
            ) : (
              <>
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={pageCount === 0 || isProjectControlsDisabled}
                  onClick={() => handleDownloadDuplex('ORIGINAL')}
                >
                  {isExporting ? 'Preparing PDF…' : 'Download PDF (original, shareable)'}
                </button>
                <button
                  className="btn btn-outline"
                  type="button"
                  disabled={
                    pageCount === 0 ||
                    !hasCalibration(activeProfile) ||
                    isProjectControlsDisabled
                  }
                  title={
                    calibratedDownloadNeedsOffsets
                      ? 'Set offsets in the calibration section to enable this.'
                      : undefined
                  }
                  onClick={() => handleDownloadDuplex('CALIBRATED')}
                >
                  Download calibrated for {activeProfile.name}
                </button>
                {calibratedDownloadNeedsOffsets && (
                  <span className="text-sm text-base-content/60">
                    Set offsets in the calibration section to enable this.
                  </span>
                )}
              </>
            )}
            <button
              className="btn btn-outline"
              type="button"
              disabled={isProjectControlsDisabled}
              onClick={handleSaveProject}
            >
              {isSavingProject ? 'Saving…' : 'Save project'}
            </button>
            <button
              className="btn btn-outline"
              type="button"
              disabled={isProjectControlsDisabled}
              onClick={() => projectFileInput.current?.click()}
            >
              {isLoadingProject ? 'Loading...' : 'Load project'}
            </button>
            <input
              ref={projectFileInput}
              className="hidden"
              type="file"
              accept=".json,application/json"
              disabled={isProjectControlsDisabled}
              onChange={handleLoadProject}
            />
          </div>
          {exportMode === 'DUPLEX' && (
            <p className="w-full text-sm text-base-content/70">
              Calibrated files only work on the printer they were measured on. Share the original.
            </p>
          )}
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
                            placeholder={
                              side === 'front' && card.frontSrc && !card.frontProcessedSrc
                                ? 'Crop required'
                                : undefined
                            }
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
