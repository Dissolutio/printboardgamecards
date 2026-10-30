import { useRef, useState, type ChangeEvent, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { pdf } from '@react-pdf/renderer'
import type { StarterBackChoice } from '../components/StarterDeckPanel.tsx'
import CalibrationDoc from '../pdf/CalibrationDoc.tsx'
import DuplexDoc from '../pdf/DuplexDoc.tsx'
import PrintAndGlueDoc from '../pdf/PrintAndGlueDoc.tsx'
import {
  createCard,
  downloadBlob,
  objectUrls,
  sideCrop,
  sideSource,
  withSideCrop,
} from '../lib/cardOps.ts'
import {
  CARD_PRESETS,
  type Size,
  type PieceOrientation,
} from '../lib/geometry.ts'
import { cropAreaSize } from '../lib/crop.ts'
import { centeredMaximumCrop, convertCropForBleedMode } from '../lib/cropConvert.ts'
import {
  duplexPdfFilename,
  exportCalibrationPt,
  type ExportKind,
  type PrinterProfile,
} from '../lib/printerProfiles.ts'
import { getImageType } from '../lib/imageType.ts'
import { loadImageSize, renderCrop } from '../lib/renderCrop.ts'
import { parseProject, serializeProject } from '../lib/project.ts'
import { findDisallowedSources } from '../lib/sourcePolicy.ts'
import { isSvgUrl } from '../lib/vectorSource.ts'
import { BACK_DESIGNS, BACK_PALETTES, backSvgToDataUrl, generateBackSvg } from '../lib/backDesigns.ts'
import { parseDeckManifest, type DeckManifest } from '../lib/deckManifest.ts'
import { buildStarterCards } from '../lib/starterDeck.ts'
import {
  backSvgSize,
  mapWithConcurrency,
  needsStarterDeckReplacementConfirmation,
} from '../lib/starterDeckBuild.ts'
import {
  convertProjectDataSourcesToBlobUrls,
  needsProjectReplacementConfirmation,
  PROJECT_FILENAME,
  validateProjectSettings,
} from '../lib/projectIo.ts'
import {
  type Grid,
  type TightGrid,
} from '../lib/layout.ts'
import { DEFAULT_BLEED, PAPER } from '../lib/geometry.ts'
import type { BleedMode, Card, CardSide, PixelCropRect } from '../types.ts'
import type { ReplaceCardsOptions } from './useCards.ts'

type PresetName = keyof typeof CARD_PRESETS
type PaperName = keyof typeof PAPER
type ExportMode = 'PRINT_GLUE' | 'DUPLEX'
type Setter<T> = Dispatch<SetStateAction<T>>

const SIDES: CardSide[] = ['front', 'back']

function isPresetName(value: string): value is PresetName {
  return Object.prototype.hasOwnProperty.call(CARD_PRESETS, value)
}

export async function prepareSideCrop(
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

type UseProjectIoOptions = {
  cards: Card[]
  cardsRef: MutableRefObject<Card[]>
  replaceCards: (cards: Card[], options?: ReplaceCardsOptions) => void
  releaseUnusedUrls: (candidates: string[], remainingCards: Card[]) => void
  beginCardOperation: (cardId: string) => number
  setSelectedId: Setter<string>
  setErrors: Setter<Record<CardSide, string | undefined>>
  presetName: PresetName
  setPresetName: Setter<PresetName>
  paperName: PaperName
  setPaperName: Setter<PaperName>
  exportMode: ExportMode
  setExportMode: Setter<ExportMode>
  pieceOrientation: PieceOrientation
  setPieceOrientation: Setter<PieceOrientation>
  appliedPreset: MutableRefObject<PresetName>
  presetGeneration: MutableRefObject<number>
  presetInProgress: MutableRefObject<boolean>
  projectOperationInProgress: MutableRefObject<boolean>
  starterDeckOperationInProgress: MutableRefObject<boolean>
  isExporting: boolean
  setIsExporting: Setter<boolean>
  setIsChangingPreset: Setter<boolean>
  onProjectOpened: () => void
  onStarterDeckCreated: () => void
  pageCount: number
  paper: Size
  grid: Grid
  tightGrid: TightGrid
  cardSize: Size
  paperProfile: PrinterProfile
  calibrationSheetCalibration: ReturnType<typeof exportCalibrationPt>
}

export function useProjectIo(options: UseProjectIoOptions) {
  const {
    cards,
    cardsRef,
    replaceCards,
    releaseUnusedUrls,
    beginCardOperation,
    setSelectedId,
    setErrors,
    presetName,
    setPresetName,
    paperName,
    setPaperName,
    exportMode,
    setExportMode,
    pieceOrientation,
    setPieceOrientation,
    appliedPreset: appliedPresetRef,
    presetGeneration: presetGenerationRef,
    presetInProgress: presetInProgressRef,
    projectOperationInProgress: projectOperationInProgressRef,
    starterDeckOperationInProgress: starterDeckOperationInProgressRef,
    isExporting,
    setIsExporting,
    setIsChangingPreset,
    onProjectOpened,
    onStarterDeckCreated,
    pageCount,
    paper,
    grid,
    tightGrid,
    cardSize,
    paperProfile,
    calibrationSheetCalibration,
  } = options
  const starterDeckGeneration = useRef(0)
  const starterDeckManifest = useRef<DeckManifest | undefined>(undefined)
  const [isSavingProject, setIsSavingProject] = useState(false)
  const [isLoadingProject, setIsLoadingProject] = useState(false)
  const [isCreatingStarterDeck, setIsCreatingStarterDeck] = useState(false)
  const [isLoadingStarterManifest, setIsLoadingStarterManifest] = useState(false)
  const [starterDeckProgress, setStarterDeckProgress] =
    useState<{ done: number; total: number }>()
  const [starterDeckError, setStarterDeckError] = useState<string>()
  const [exportError, setExportError] = useState<string>()

  async function handleSaveProject() {
    if (
      projectOperationInProgressRef.current ||
      presetInProgressRef.current ||
      isExporting
    ) {
      return
    }

    projectOperationInProgressRef.current = true
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
      projectOperationInProgressRef.current = false
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
    if (projectOperationInProgressRef.current || presetInProgressRef.current || isExporting) {
      setExportError('Finish the current operation before loading a project.')
      input.value = ''
      return
    }

    projectOperationInProgressRef.current = true
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

      generation = ++presetGenerationRef.current
      presetInProgressRef.current = true
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
        generation !== presetGenerationRef.current ||
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
      appliedPresetRef.current = nextSettings.presetName
      replaceCards(cardsToApply, {
        settings: nextSettings,
        label: 'projectOpened',
      })
      setSelectedId(cardsToApply[0].id)
      setErrors({ front: undefined, back: undefined })
      releaseUnusedUrls(originalCards.flatMap(objectUrls), cardsToApply)
      onProjectOpened()
    } catch (error) {
      generatedUrls.forEach(URL.revokeObjectURL)
      setExportError(
        error instanceof Error
          ? `Could not load the project: ${error.message}`
          : 'Could not load the project. Please try again.',
      )
    } finally {
      if (ownsPresetLock && generation === presetGenerationRef.current) {
        presetInProgressRef.current = false
        setIsChangingPreset(false)
      }
      projectOperationInProgressRef.current = false
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
      starterDeckOperationInProgressRef.current ||
      presetInProgressRef.current ||
      projectOperationInProgressRef.current ||
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
    starterDeckOperationInProgressRef.current = true
    presetInProgressRef.current = true
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
      replaceCards(completedCards, { label: 'starterDeckCreated' })
      setSelectedId(completedCards[0].id)
      setErrors({ front: undefined, back: undefined })
      releaseUnusedUrls(originalCards.flatMap(objectUrls), completedCards)
      setExportError(undefined)
      onStarterDeckCreated()
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
        starterDeckOperationInProgressRef.current = false
        presetInProgressRef.current = false
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
    if (presetInProgressRef.current || projectOperationInProgressRef.current) return
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
          calibration={exportCalibrationPt(kind, paperProfile)}
        />,
      ).toBlob()
      downloadBlob(
        pdfBlob,
        duplexPdfFilename(kind, paperName, paperProfile.name),
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
    if (presetInProgressRef.current || projectOperationInProgressRef.current) return
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
    if (presetInProgressRef.current || projectOperationInProgressRef.current) return
    setIsExporting(true)
    setExportError(undefined)

    try {
      const pdfBlob = await pdf(
        <CalibrationDoc
          paper={paper}
          cardSize={cardSize}
          grid={grid}
          calibration={calibrationSheetCalibration}
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

  return {
    isSavingProject,
    isLoadingProject,
    isCreatingStarterDeck,
    isLoadingStarterManifest,
    starterDeckProgress,
    starterDeckError,
    exportError,
    setExportError,
    handleSaveProject,
    handleLoadProject,
    handleCreateStarterDeck,
    handleDownloadDuplex,
    handleDownload,
    handleDownloadCalibrationSheet,
  }
}
