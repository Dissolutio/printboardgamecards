import { useRef, useState, type ChangeEvent } from 'react'
import { pdf } from '@react-pdf/renderer'
import CardEditor from './components/CardEditor.tsx'
import CardList from './components/CardList.tsx'
import ExportPanel from './components/ExportPanel.tsx'
import PrintSettingsPanel from './components/PrintSettingsPanel.tsx'
import PrintPreview from './components/PrintPreview.tsx'
import StarterDeckPanel, { type StarterBackChoice } from './components/StarterDeckPanel.tsx'
import { useCards } from './hooks/useCards.ts'
import { usePrinterProfiles } from './hooks/usePrinterProfiles.ts'
import CalibrationDoc from './pdf/CalibrationDoc.tsx'
import DuplexDoc from './pdf/DuplexDoc.tsx'
import PrintAndGlueDoc from './pdf/PrintAndGlueDoc.tsx'
import {
  createCard,
  downloadBlob,
  estimatedScaleMessage,
  expectedScaleTotalMessage,
  objectUrls,
  sideCrop,
  sideProcessedSource,
  sideSource,
  withSideCrop,
} from './lib/cardOps.ts'
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
  duplexPdfFilename,
  exportCalibrationPt,
  hasCalibration,
  type ExportKind,
} from './lib/printerProfiles.ts'
import { parseMeasurement } from './lib/calibrationInput.ts'
import { getImageType } from './lib/imageType.ts'
import {
  expectedScaleGapSpaces,
  SHEET_WIDTH_MM,
} from './lib/calibrationScale.ts'
import { loadImageSize, renderCrop } from './lib/renderCrop.ts'
import { parseProject, serializeProject } from './lib/project.ts'
import { findDisallowedSources } from './lib/sourcePolicy.ts'
import { isSvgUrl } from './lib/vectorSource.ts'
import { BACK_DESIGNS, BACK_PALETTES, backSvgToDataUrl, generateBackSvg } from './lib/backDesigns.ts'
import { parseDeckManifest, type DeckManifest } from './lib/deckManifest.ts'
import { buildStarterCards } from './lib/starterDeck.ts'
import {
  backSvgSize,
  mapWithConcurrency,
  needsStarterDeckReplacementConfirmation,
} from './lib/starterDeckBuild.ts'
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
const calibrationNumberFormat = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
type PaperName = keyof typeof PAPER
type PresetName = keyof typeof CARD_PRESETS
type ExportMode = 'PRINT_GLUE' | 'DUPLEX'
function isPresetName(value: string): value is PresetName {
  return Object.prototype.hasOwnProperty.call(CARD_PRESETS, value)
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

async function fileToDataUrl(file: File): Promise<string> {
  const type = getImageType(file)
  const sourceFile =
    (!file.type || file.type.toLowerCase() === 'application/octet-stream') && type
      ? new Blob([file], { type })
      : file
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Could not read the image. Choose a different image and try again.'))
      }
    }
    reader.onerror = () => {
      reject(new Error('Could not read the image. Choose a different image and try again.'))
    }
    reader.readAsDataURL(sourceFile)
  })
}

async function dataUrlToBlobUrl(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Could not read an image from the project file.')
  return URL.createObjectURL(await response.blob())
}

function App() {
  const presetGeneration = useRef(0)
  const presetInProgress = useRef(false)
  const projectOperationInProgress = useRef(false)
  const starterDeckGeneration = useRef(0)
  const starterDeckOperationInProgress = useRef(false)
  const starterDeckManifest = useRef<DeckManifest | undefined>(undefined)
  const appliedPreset = useRef<PresetName>('POKER')
  const projectFileInput = useRef<HTMLInputElement>(null)
  const [presetName, setPresetName] = useState<PresetName>('POKER')
  const [isChangingPreset, setIsChangingPreset] = useState(false)
  const [isSavingProject, setIsSavingProject] = useState(false)
  const [isLoadingProject, setIsLoadingProject] = useState(false)
  const [isCreatingStarterDeck, setIsCreatingStarterDeck] = useState(false)
  const [isLoadingStarterManifest, setIsLoadingStarterManifest] = useState(false)
  const [starterDeckProgress, setStarterDeckProgress] =
    useState<{ done: number; total: number }>()
  const [starterDeckError, setStarterDeckError] = useState<string>()
  const [paperName, setPaperName] = useState<PaperName>('LETTER')
  const [exportMode, setExportMode] = useState<ExportMode>('PRINT_GLUE')
  const [pieceOrientation, setPieceOrientation] = useState<PieceOrientation>('AUTO')
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string>()
  const cardState = useCards({
    appliedPreset,
    presetInProgress,
    projectOperationInProgress,
    starterDeckOperationInProgress,
    isExporting,
  })
  const {
    cards,
    cardsRef,
    selectedId,
    setSelectedId,
    errors,
    setErrors,
    replaceCards,
    releaseUnusedUrls,
    beginCardOperation,
    isCurrentCardOperation,
    updateCard,
    handleQuantityStep,
    handleAddCard,
    handleDuplicateCard,
    handleDeleteCard,
    handleImageSelect,
    handleImageRemove,
    handleCropChange,
    handleUseBackForEveryCard,
    handleProcessedImage,
    handleError,
  } = cardState

  const paper = PAPER[paperName]
  const cardSize = CARD_PRESETS[presetName]
  const grid = calculateGrid({ paper, card: cardSize, bleed: DEFAULT_BLEED })
  const tightGrid = calculateTightGrid({
    paper,
    card: cardSize,
    orientation: pieceOrientation,
  })
  const printer = usePrinterProfiles({ paper, paperName, grid, cardSize })
  const {
    printerProfiles,
    activeProfile,
    calibrationDraft,
    setCalibrationDraft,
    observedXmm,
    setObservedXmm,
    observedYmm,
    setObservedYmm,
    scaleGapInput,
    setScaleGapInput,
    calibrationUpdated,
    setCalibrationUpdated,
    calibrationStorageWarning,
    calibrationPt,
    hasCalibrationScale,
    validScaleGap,
    scaleEstimate,
    commitCalibrationAxis,
    resetCalibration,
    applyObservedCorrection,
    handleSelectPrinter,
    handleAddPrinter,
    handleRenamePrinter,
    handleDeletePrinter,
  } = printer
  const selectedCard = cards.find((card) => card.id === selectedId)
  const isProjectControlsDisabled =
    isChangingPreset || isSavingProject || isLoadingProject || isExporting || isCreatingStarterDeck
  const pageCount =
    exportMode === 'PRINT_GLUE'
      ? layoutPrintAndGlue(cards, tightGrid).length
      : layoutDuplexPages(cards, grid, exportCalibrationPt('ORIGINAL', activeProfile)).length
  const calibratedDownloadNeedsOffsets =
    pageCount > 0 && !hasCalibration(activeProfile) && !isProjectControlsDisabled

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
      releaseUnusedUrls(
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
        releaseUnusedUrls(
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
      releaseUnusedUrls(originalCards.flatMap(objectUrls), cardsToApply)
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

  async function handleCreateStarterDeck({
    includeJokers,
    back,
  }: {
    includeJokers: boolean
    back: StarterBackChoice
  }): Promise<boolean> {
    if (
      starterDeckOperationInProgress.current ||
      presetInProgress.current ||
      projectOperationInProgress.current ||
      isExporting
    ) {
      return false
    }

    if (
      needsStarterDeckReplacementConfirmation(cardsRef.current) &&
      !window.confirm('Replace the current deck with a new standard deck? This cannot be undone.')
    ) {
      return false
    }

    const generation = ++starterDeckGeneration.current
    const originalCards = cardsRef.current
    const generatedUrls: string[] = []
    starterDeckOperationInProgress.current = true
    presetInProgress.current = true
    setIsCreatingStarterDeck(true)
    setIsChangingPreset(true)
    setStarterDeckError(undefined)
    setStarterDeckProgress(undefined)
    setExportError(undefined)
    let created = false
    for (const card of originalCards) beginCardOperation(card.id)

    try {
      let manifest = starterDeckManifest.current
      if (!manifest) {
        setIsLoadingStarterManifest(true)
        let response: Response
        try {
          response = await fetch(`${import.meta.env.BASE_URL}decks/classic/manifest.json`)
        } catch {
          throw new Error('Could not load the standard deck. Check your connection and try again.')
        }
        if (!response.ok) {
          throw new Error('Could not load the standard deck. Check your connection and try again.')
        }
        let manifestValue: unknown
        try {
          manifestValue = await response.json()
        } catch {
          throw new Error('The standard deck data is invalid. Reload the page and try again.')
        }
        const parsedManifest = parseDeckManifest(manifestValue)
        if (!parsedManifest.ok) {
          throw new Error('The standard deck data is invalid. Reload the page and try again.')
        }
        manifest = parsedManifest.manifest
        starterDeckManifest.current = manifest
      }

      let backSrc: string
      let backCrop: PixelCropRect | undefined
      let backProcessedBlob: Blob | undefined
      let backIsVector: boolean
      if (back.type === 'image') {
        if (!back.draftCard.backCrop) {
          throw new Error('Choose and crop a back image before creating the deck.')
        }
        backSrc = await fileToDataUrl(back.file)
        backCrop = { ...back.draftCard.backCrop }
        backProcessedBlob = back.processedBlob
        backIsVector = back.draftCard.backIsVector ?? false
      } else {
        const design = BACK_DESIGNS.find((option) => option.id === back.design)
        const palette = BACK_PALETTES.find((option) => option.id === back.paletteId)
        if (!design || !palette) {
          throw new Error('Choose a valid back design and palette.')
        }
        const size = backSvgSize(cardSize)
        backSrc = backSvgToDataUrl(
          generateBackSvg({
            design: back.design,
            width: size.width,
            height: size.height,
            primary: palette.primary,
            secondary: palette.secondary,
            border: back.border,
          }),
        )
        backIsVector = true
      }

      const newCards = buildStarterCards({
        manifest,
        baseUrl: `${import.meta.env.BASE_URL}decks/classic`,
        includeJokers,
        makeId: () => crypto.randomUUID(),
        backSrc,
      }).map((card) => ({
        ...card,
        frontIsVector: isSvgUrl(card.frontSrc ?? ''),
        backIsVector,
        ...(backCrop ? { backCrop: { ...backCrop } } : {}),
      }))
      if (newCards.length !== (includeJokers ? 54 : 52)) {
        throw new Error('The standard deck data is invalid. Reload the page and try again.')
      }
      const processedCards = await mapWithConcurrency(
        newCards,
        4,
        async (card) => {
          const result = await prepareSideCrop(card, 'front', cardSize, 'COLOR', false)
          if (!result) throw new Error('Could not process a card image.')
          const processedSource = URL.createObjectURL(result.blob)
          generatedUrls.push(processedSource)
          let processedCard = withSideCrop(card, 'front', result.crop, processedSource)
          if (!backProcessedBlob) {
            const backResult = await prepareSideCrop(
              processedCard,
              'back',
              cardSize,
              'COLOR',
              false,
            )
            if (!backResult) throw new Error('Could not process a card image.')
            const backProcessedSource = URL.createObjectURL(backResult.blob)
            generatedUrls.push(backProcessedSource)
            processedCard = withSideCrop(
              processedCard,
              'back',
              backResult.crop,
              backProcessedSource,
            )
          }
          return processedCard
        },
        (done, total) => setStarterDeckProgress({ done, total }),
      )
      const completedCards = processedCards.map((card) => {
        if (!backProcessedBlob) return card
        const backProcessedSrc = URL.createObjectURL(
          new Blob([backProcessedBlob], { type: backProcessedBlob.type }),
        )
        generatedUrls.push(backProcessedSrc)
        return { ...card, backProcessedSrc }
      })

      if (
        generation !== starterDeckGeneration.current ||
        cardsRef.current !== originalCards
      ) {
        generatedUrls.forEach(URL.revokeObjectURL)
        if (cardsRef.current !== originalCards) {
          setStarterDeckError(
            'The deck changed while creating the standard deck. Please try again.',
          )
        }
        return false
      }

      for (const card of originalCards) beginCardOperation(card.id)
      replaceCards(completedCards)
      setSelectedId(completedCards[0].id)
      setErrors({ front: undefined, back: undefined })
      releaseUnusedUrls(originalCards.flatMap(objectUrls), completedCards)
      setExportError(undefined)
      created = true
    } catch (error) {
      generatedUrls.forEach(URL.revokeObjectURL)
      const message = error instanceof Error ? error.message : ''
      setStarterDeckError(
        message.startsWith('Could not load the standard deck.') ||
          message.startsWith('The standard deck data is invalid.') ||
          message.startsWith('Could not read the image.') ||
          message.startsWith('Choose a valid back design')
          ? message
          : 'Could not create the standard deck. Check the image files and try again.',
      )
    } finally {
      if (generation === starterDeckGeneration.current) {
        starterDeckOperationInProgress.current = false
        presetInProgress.current = false
        setIsCreatingStarterDeck(false)
        setIsLoadingStarterManifest(false)
        setIsChangingPreset(false)
      }
    }
    return created
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

        <StarterDeckPanel
          cardSize={cardSize}
          paperName={paperName}
          disabled={isProjectControlsDisabled}
          isLoadingManifest={isLoadingStarterManifest}
          isProcessing={isCreatingStarterDeck}
          progress={starterDeckProgress}
          error={starterDeckError}
          onCreate={handleCreateStarterDeck}
        />

        <div inert={isProjectControlsDisabled}>
        <PrintSettingsPanel
          presetName={presetName}
          paperName={paperName}
          exportMode={exportMode}
          pieceOrientation={pieceOrientation}
          disabled={isProjectControlsDisabled}
          loadingProject={isLoadingProject}
          onPresetChange={(value) => {
            if (isPresetName(value)) handlePresetChange(value)
          }}
          onPaperChange={(value) => {
            const selectedPaper = PAPER_OPTIONS.find((option) => option === value)
            if (selectedPaper) setPaperName(selectedPaper)
          }}
          onExportModeChange={(value) =>
            setExportMode(value === 'DUPLEX' ? 'DUPLEX' : 'PRINT_GLUE')
          }
          onPieceOrientationChange={(value) =>
            setPieceOrientation(
              value === 'UPRIGHT' || value === 'ROTATED' ? value : 'AUTO',
            )
          }
        />

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

        <CardList
          cards={cards}
          selectedId={selectedId}
          cardSize={cardSize}
          disabled={isProjectControlsDisabled}
          onAdd={handleAddCard}
          onSelect={(cardId) => {
            setSelectedId(cardId)
            setErrors({ front: undefined, back: undefined })
          }}
          onQuantityStep={handleQuantityStep}
          onDuplicate={handleDuplicateCard}
          onDelete={handleDeleteCard}
        />

        <ExportPanel
          cards={cards}
          pageCount={pageCount}
          exportMode={exportMode}
          activeProfile={activeProfile}
          calibratedDownloadNeedsOffsets={calibratedDownloadNeedsOffsets}
          disabled={isProjectControlsDisabled}
          isExporting={isExporting}
          isSavingProject={isSavingProject}
          isLoadingProject={isLoadingProject}
          exportError={exportError}
          projectFileInput={projectFileInput}
          onDownload={handleDownload}
          onDownloadDuplex={handleDownloadDuplex}
          onSaveProject={handleSaveProject}
          onLoadProject={handleLoadProject}
        />

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
              onUseBackForEveryCard={handleUseBackForEveryCard}
            />
          </section>
        ) : (
          <p className="mb-6 rounded-box bg-base-100 p-6 text-center text-base-content/60">
            Add a card to start building your deck.
          </p>
        )}

        <PrintPreview
          cards={cards}
          cardSize={cardSize}
          disabled={isProjectControlsDisabled}
          onQuantityStep={handleQuantityStep}
        />
        </div>
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
