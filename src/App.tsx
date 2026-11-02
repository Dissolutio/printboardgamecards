import { useEffect, useRef, useState } from 'react'
import StartScreen from './components/StartScreen.tsx'
import CalibrationPanel from './components/CalibrationPanel.tsx'
import CardList from './components/CardList.tsx'
import { Dialog } from './components/Dialog.tsx'
import ExportPanel from './components/ExportPanel.tsx'
import PrintSettingsPanel from './components/PrintSettingsPanel.tsx'
import PrintPreview from './components/PrintPreview.tsx'
import SelectedCardEditor from './components/SelectedCardEditor.tsx'
import SummaryStrip from './components/SummaryStrip.tsx'
import Toast from './components/Toast.tsx'
import { useConfirm } from './components/useConfirm.tsx'
import { useCards } from './hooks/useCards.ts'
import { prepareSideCrop, useProjectIo } from './hooks/useProjectIo.tsx'
import { usePrinterProfiles } from './hooks/usePrinterProfiles.ts'
import {
  useSettings,
  type PresetName,
} from './hooks/useSettings.ts'
import {
  createCard,
  sideProcessedSource,
  sideSource,
  withSideCrop,
} from './lib/cardOps.ts'
import { chooseScreen, type AppScreen } from './lib/startScreen.ts'
import {
  calculateGrid,
  calculateTightGrid,
  CARD_PRESETS,
  DEFAULT_BLEED,
  PAPER,
} from './lib/geometry.ts'
import {
  exportCalibrationPt,
  hasCalibration,
} from './lib/printerProfiles.ts'
import {
  layoutDuplexPages,
  layoutPrintAndGlue,
} from './lib/layout.ts'
import { totalCopies } from './lib/deck.ts'
import {
  describeLayout,
  summarizeAllModes,
  summarizePrint,
  type PrintMode,
} from './lib/printSummary.ts'
import { hasBackground } from './lib/piece.ts'
import type { BleedMode, CardSide } from './types.ts'
import { createTranslator } from './i18n/messages.ts'
import { en } from './i18n/en.ts'
import { formatNumber } from './i18n/numbers.ts'
import type { HistorySettings } from './lib/history.ts'

const SIDES: CardSide[] = ['front', 'back']
const PAPER_OPTIONS: (keyof typeof PAPER)[] = ['LETTER', 'A4']
const translate = createTranslator(en, 'en')
function isPresetName(value: string): value is PresetName {
  return Object.prototype.hasOwnProperty.call(CARD_PRESETS, value)
}

function App() {
  const presetGeneration = useRef(0)
  const presetInProgress = useRef(false)
  const projectOperationInProgress = useRef(false)
  const starterDeckOperationInProgress = useRef(false)
  const appliedPreset = useRef<PresetName>('POKER')
  const projectFileInput = useRef<HTMLInputElement>(null)
  const openProjectFileInput = useRef<HTMLInputElement>(null)
  const {
    presetName,
    setPresetName,
    paperName,
    setPaperName,
    exportMode,
    setExportMode,
    pieceOrientation,
    setPieceOrientation,
  } = useSettings()
  const [isChangingPreset, setIsChangingPreset] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [projectName, setProjectName] = useState('Untitled deck')
  const [deckMenuOpen, setDeckMenuOpen] = useState(false)
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false)
  const [calibrationDialogOpen, setCalibrationDialogOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string>()
  const toastTimer = useRef<number | undefined>(undefined)
  const historyBusyRef = useRef(false)
  const projectLoadInProgressRef = useRef(false)
  const requestedPrintModeRef = useRef<PrintMode | undefined>(undefined)
  const previousExportModeRef = useRef(exportMode)
  const showUndoToast = (
    key:
      | 'undo.toast.cardDeleted'
      | 'undo.toast.imageRemoved'
      | 'undo.toast.backsReplaced'
      | 'undo.toast.projectOpened'
      | 'undo.toast.starterDeckCreated',
    params?: { count: number },
  ) => {
    setToastMessage(translate(key, params))
    if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => {
      setToastMessage(undefined)
      toastTimer.current = undefined
    }, 8000)
  }
  const initialHistorySettings: HistorySettings = {
    presetName,
    paperName,
    exportMode,
    pieceOrientation,
  }
  const { confirm, dialog: confirmDialog } = useConfirm()
  const cardState = useCards({
    appliedPreset,
    presetInProgress,
    projectOperationInProgress,
    starterDeckOperationInProgress,
    isExporting,
    confirm,
    settings: initialHistorySettings,
    restoreSettings: (settings) => {
      setPresetName(settings.presetName)
      setPaperName(settings.paperName)
      setExportMode(settings.exportMode)
      setPieceOrientation(settings.pieceOrientation)
      appliedPreset.current = settings.presetName
    },
    isHistoryBusy: () =>
      starterDeckOperationInProgress.current ||
      projectOperationInProgress.current ||
      presetInProgress.current ||
      isExporting,
    showUndoToast,
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
  const [screen, setScreen] = useState<AppScreen>(() => chooseScreen(cards))
  const currentScreen = chooseScreen(cards) === 'workspace' ? 'workspace' : screen

  function updateSettings(next: Partial<HistorySettings>) {
    const updated = cardState.commitSettings(next)
    if (next.presetName !== undefined) setPresetName(updated.presetName)
    if (next.paperName !== undefined) setPaperName(updated.paperName)
    if (next.exportMode !== undefined) setExportMode(updated.exportMode)
    if (next.pieceOrientation !== undefined) {
      setPieceOrientation(updated.pieceOrientation)
    }
  }

  function handlePrintModeChange(nextMode: PrintMode) {
    const nextExportMode =
      nextMode === 'ONE_SIDE_GLUE' ? 'PRINT_GLUE' : 'DUPLEX'
    if (nextExportMode !== exportMode) {
      requestedPrintModeRef.current = nextMode
    }
    setPrintMode(nextMode)
    updateSettings({ exportMode: nextExportMode })
  }

  function undoFromToast() {
    setToastMessage(undefined)
    if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current)
    toastTimer.current = undefined
    cardState.undo()
  }

  useEffect(() => {
    function handleHistoryShortcut(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      const key = event.key.toLowerCase()
      const isUndo = key === 'z' && !event.shiftKey
      const isRedo = (key === 'z' && event.shiftKey) || (key === 'y' && !event.shiftKey)
      if (!isUndo && !isRedo) return

      const target = event.target
      if (target instanceof HTMLElement) {
        const field = target.closest('input, textarea, select, [contenteditable="true"]')
        if (field instanceof HTMLInputElement) {
          if (['text', 'number', 'color'].includes(field.type)) return
        } else if (field) {
          return
        }
      }
      if (historyBusyRef.current) return

      event.preventDefault()
      if (isUndo) cardState.undo()
      else cardState.redo()
    }

    window.addEventListener('keydown', handleHistoryShortcut)
    return () => window.removeEventListener('keydown', handleHistoryShortcut)
  }, [cardState])

  useEffect(
    () => () => {
      if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current)
    },
    [],
  )

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
    rulerDistanceInput,
    setRulerDistanceInput,
    calibrationUpdated,
    setCalibrationUpdated,
    calibrationStorageWarning,
    calibrationPt,
    hasCalibrationScale,
    hasFoldGauge,
    validScaleGap,
    scaleEstimate,
    validRulerDistance,
    rulerEstimate,
    commitCalibrationAxis,
    resetCalibration,
    applyObservedCorrection,
    handleSelectPrinter,
    handleAddPrinter,
    handleRenamePrinter,
    handleDeletePrinter,
  } = printer
  const selectedCard = cards.find((card) => card.id === selectedId)
  const pageCount =
    exportMode === 'PRINT_GLUE'
      ? layoutPrintAndGlue(cards, tightGrid).length
      : layoutDuplexPages(cards, grid, exportCalibrationPt('ORIGINAL', activeProfile)).length
  const projectIo = useProjectIo({
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
    appliedPreset,
    presetGeneration,
    presetInProgress,
    projectOperationInProgress,
    starterDeckOperationInProgress,
    isExporting,
    setIsExporting,
    setIsChangingPreset,
    confirm,
    onProjectOpened: () => {
      setScreen('workspace')
      showUndoToast('undo.toast.projectOpened')
    },
    onStarterDeckCreated: () => {
      setScreen('workspace')
      showUndoToast('undo.toast.starterDeckCreated')
    },
    pageCount,
    paper,
    grid,
    tightGrid,
    cardSize,
    paperProfile: activeProfile,
    calibrationSheetCalibration: calibrationPt,
  })
  const {
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
  } = projectIo
  const historyBusy =
    isChangingPreset ||
    isSavingProject ||
    isLoadingProject ||
    isCreatingStarterDeck ||
    isExporting
  const [printMode, setPrintMode] = useState<PrintMode>(() =>
    exportMode === 'DUPLEX' ? 'TWO_SIDES_HAND' : 'ONE_SIDE_GLUE',
  )
  useEffect(() => {
    if (isLoadingProject) {
      projectLoadInProgressRef.current = true
      return
    }

    if (projectLoadInProgressRef.current) {
      setPrintMode(exportMode === 'DUPLEX' ? 'TWO_SIDES_HAND' : 'ONE_SIDE_GLUE')
      projectLoadInProgressRef.current = false
      requestedPrintModeRef.current = undefined
      previousExportModeRef.current = exportMode
      return
    }

    if (previousExportModeRef.current === exportMode) return
    previousExportModeRef.current = exportMode

    if (requestedPrintModeRef.current) {
      requestedPrintModeRef.current = undefined
      return
    }

    const restoredMode =
      exportMode === 'DUPLEX' ? 'TWO_SIDES_HAND' : 'ONE_SIDE_GLUE'
    setPrintMode(restoredMode)
  }, [exportMode, isLoadingProject])
  useEffect(() => {
    historyBusyRef.current = historyBusy
  }, [historyBusy])
  const isProjectControlsDisabled =
    isChangingPreset || isSavingProject || isLoadingProject || isExporting || isCreatingStarterDeck
  const calibratedDownloadNeedsOffsets =
    pageCount > 0 && !hasCalibration(activeProfile) && !isProjectControlsDisabled
  const summaries = summarizeAllModes({
    cards,
    presetName,
    paperName,
    pieceOrientation,
  })
  const autoSummary = summarizePrint({
    cards,
    presetName,
    paperName,
    pieceOrientation: 'AUTO',
    mode: 'ONE_SIDE_GLUE',
  })
  const locale = new Intl.NumberFormat().resolvedOptions().locale
  const summaryDescription = describeLayout(summaries[printMode], {
    locale,
    paperName,
    translate,
  })
  const cardCount = totalCopies(cards)
  const selectedHasBack = Boolean(
    selectedCard &&
      (selectedCard.backSrc ||
        selectedCard.backProcessedSrc ||
        hasBackground(selectedCard, 'back')),
  )
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
      replaceCards(nextCards, {
        settings: {
          presetName: nextPreset,
          paperName,
          exportMode,
          pieceOrientation,
        },
        label: 'presetChanged',
      })
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

  async function handleStartNewDeck() {
    const hasImages = cards.some(
      (card) =>
        card.frontSrc ||
        card.backSrc ||
        card.frontProcessedSrc ||
        card.backProcessedSrc,
    )
    if (
      hasImages &&
      !(await confirm({
        title: 'Start a new deck?',
        message: 'This replaces the cards you have now. You can undo this.',
        confirmLabel: 'Start new deck',
      }))
    ) {
      return
    }

    const nextCard = createCard(crypto.randomUUID())
    replaceCards([nextCard], { label: 'starterDeckCreated' })
    setSelectedId(nextCard.id)
    setProjectName('Untitled deck')
    setErrors({ front: undefined, back: undefined })
    setScreen('start')
    showUndoToast('undo.toast.starterDeckCreated')
  }

  return (
    <>
      {currentScreen === 'start' ? (
        <StartScreen
          cardSize={cardSize}
          presetName={presetName}
          paperName={paperName}
          exportMode={exportMode}
          pieceOrientation={pieceOrientation}
          disabled={isProjectControlsDisabled}
          isLoadingManifest={isLoadingStarterManifest}
          isProcessing={isCreatingStarterDeck}
          progress={starterDeckProgress}
          error={starterDeckError}
          onCreate={handleCreateStarterDeck}
          onOpenProject={handleLoadProject}
          projectFileInput={projectFileInput}
          onStartWithOneCard={() => setScreen('workspace')}
        />
      ) : (
        <main className="min-h-screen bg-base-200 text-base-content">
          <header className="flex flex-wrap items-center gap-3 border-b border-base-300 px-4 py-3 sm:px-8">
            <div className="flex min-w-0 flex-1 basis-full items-center gap-3 sm:basis-auto">
              <svg
                aria-label="Printboard Game Cards"
                className="h-7 w-7 shrink-0"
                role="img"
                viewBox="0 0 32 32"
              >
                <rect
                  x="3"
                  y="6"
                  width="16"
                  height="22"
                  rx="2"
                  fill="#2c3547"
                  stroke="#8f7bff"
                  strokeWidth="1.5"
                  transform="rotate(-10 11 17)"
                />
                <rect
                  x="12"
                  y="4"
                  width="16"
                  height="22"
                  rx="2"
                  fill="#e8ecf4"
                  stroke="#8f7bff"
                  strokeWidth="1.5"
                  transform="rotate(8 20 15)"
                />
              </svg>
              <label className="sr-only" htmlFor="workspace-project-name">
                Project name
              </label>
              <input
                id="workspace-project-name"
                aria-label="Project name"
                className="input input-ghost h-11 min-w-0 max-w-56 flex-1 px-2 text-base font-semibold"
                type="text"
                value={projectName}
                onChange={(event) => setProjectName(event.currentTarget.value)}
              />
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              <button
                className="btn btn-outline min-h-11 px-3"
                type="button"
                disabled={historyBusy || !cardState.canUndo}
                onClick={cardState.undo}
              >
                {translate('undo.button')}
              </button>
              <button
                className="btn btn-outline min-h-11 px-3"
                type="button"
                disabled={historyBusy || !cardState.canRedo}
                onClick={cardState.redo}
              >
                {translate('redo.button')}
              </button>
              <button
                className="btn btn-outline min-h-11 px-3"
                type="button"
                disabled={isProjectControlsDisabled}
                onClick={handleSaveProject}
              >
                Save project file
              </button>
              <div className="relative">
                <button
                  aria-expanded={deckMenuOpen}
                  className="btn btn-outline min-h-11 px-3"
                  type="button"
                  disabled={isProjectControlsDisabled}
                  onClick={() => setDeckMenuOpen((open) => !open)}
                >
                  Deck menu
                </button>
                {deckMenuOpen && (
                  <div
                    className="absolute right-0 top-full z-40 mt-2 flex min-w-52 flex-col rounded-box border border-base-300 bg-base-100 p-2 shadow-xl"
                    role="menu"
                  >
                    <button
                      className="btn btn-ghost min-h-11 justify-start"
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setDeckMenuOpen(false)
                        void handleStartNewDeck()
                      }}
                    >
                      New deck
                    </button>
                    <button
                      className="btn btn-ghost min-h-11 justify-start"
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setDeckMenuOpen(false)
                        openProjectFileInput.current?.click()
                      }}
                    >
                      Open project file
                    </button>
                    <button
                      className="btn btn-ghost min-h-11 justify-start"
                      type="button"
                      role="menuitem"
                      disabled={!selectedHasBack}
                      onClick={() => {
                        setDeckMenuOpen(false)
                        void handleUseBackForEveryCard()
                      }}
                    >
                      Change every back
                    </button>
                    <button
                      className="btn btn-ghost min-h-11 justify-start"
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setDeckMenuOpen(false)
                        handleAddCard()
                      }}
                    >
                      Add card
                    </button>
                  </div>
                )}
              </div>
              <button
                className="btn btn-primary min-h-11 px-4"
                type="button"
                onClick={() => setDownloadDialogOpen(true)}
              >
                Download
              </button>
            </div>
          </header>

          <div inert={isProjectControlsDisabled}>
            <SummaryStrip
              summaries={summaries}
              mode={printMode}
              cardCount={cardCount}
              layoutDescription={summaryDescription}
            />
            <div className="mx-auto grid max-w-[1440px] grid-cols-[minmax(0,1fr)_360px] items-start gap-6 px-8 py-6 max-[699px]:grid-cols-1 max-[699px]:gap-5 max-[699px]:px-4">
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
                onChangeEveryBack={() => void handleUseBackForEveryCard()}
              />

              <aside className="space-y-4">
                <PrintSettingsPanel
                  presetName={presetName}
                  paperName={paperName}
                  printMode={printMode}
                  pieceOrientation={pieceOrientation}
                  summaries={summaries}
                  autoSummary={autoSummary}
                  cardCount={cardCount}
                  disabled={isProjectControlsDisabled}
                  loadingProject={isLoadingProject}
                  onPresetChange={(value) => {
                    if (isPresetName(value)) void handlePresetChange(value)
                  }}
                  onPaperChange={(value) => {
                    const selectedPaper = PAPER_OPTIONS.find(
                      (option) => option === value,
                    )
                    if (selectedPaper) updateSettings({ paperName: selectedPaper })
                  }}
                  onPrintModeChange={handlePrintModeChange}
                  onPieceOrientationChange={(value) =>
                    updateSettings({
                      pieceOrientation:
                        value === 'UPRIGHT' || value === 'ROTATED' ? value : 'AUTO',
                    })
                  }
                />

                {printMode !== 'ONE_SIDE_GLUE' && (
                  <section className="space-y-3 rounded-[14px] border border-base-300 bg-base-100 p-5">
                    <h2 className="m-0 text-lg font-semibold">Two-sided printing</h2>
                    <p className="m-0 text-sm leading-6 text-base-content/70">
                      Printer: {activeProfile.name}. Offset X{' '}
                      {formatNumber(activeProfile.offsetXmm, locale, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      mm, Y{' '}
                      {formatNumber(activeProfile.offsetYmm, locale, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      mm.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="btn btn-outline min-h-11"
                        type="button"
                        disabled={isProjectControlsDisabled}
                        onClick={() => setCalibrationDialogOpen(true)}
                      >
                        Calibrate printer
                      </button>
                      <button
                        className="btn btn-outline min-h-11"
                        type="button"
                        disabled={isProjectControlsDisabled}
                        onClick={() => setCalibrationDialogOpen(true)}
                      >
                        Change printer
                      </button>
                    </div>
                  </section>
                )}
              </aside>
            </div>

            <div className="mx-auto max-w-[1440px] space-y-6 px-8 pb-8 max-[699px]:px-4">
              <SelectedCardEditor
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

              <div className="scroll-mt-24" id="print-preview">
                <PrintPreview
                  cards={cards}
                  cardSize={cardSize}
                  disabled={isProjectControlsDisabled}
                  onQuantityStep={handleQuantityStep}
                />
              </div>
              <footer className="text-center text-xs text-base-content/50">
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
          </div>
        </main>
      )}

      <input
        ref={openProjectFileInput}
        className="hidden"
        type="file"
        accept=".json,application/json"
        disabled={isProjectControlsDisabled}
        onChange={handleLoadProject}
      />

      <Dialog
        open={downloadDialogOpen}
        onClose={() => setDownloadDialogOpen(false)}
        title="Download"
        footer={
          <div className="flex justify-end">
            <button
              className="btn btn-outline min-h-11"
              type="button"
              onClick={() => setDownloadDialogOpen(false)}
            >
              Close
            </button>
          </div>
        }
      >
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
      </Dialog>

      <Dialog
        open={calibrationDialogOpen}
        onClose={() => setCalibrationDialogOpen(false)}
        title="Two-sided printing"
        fullScreenOnPhone
        footer={
          <div className="flex justify-end">
            <button
              className="btn btn-outline min-h-11"
              type="button"
              onClick={() => setCalibrationDialogOpen(false)}
            >
              Close
            </button>
          </div>
        }
      >
        <CalibrationPanel
          disabled={isProjectControlsDisabled}
          printerProfiles={printerProfiles}
          activeProfile={activeProfile}
          hasCalibrationScale={hasCalibrationScale}
          hasFoldGauge={hasFoldGauge}
          scaleGapInput={scaleGapInput}
          setScaleGapInput={setScaleGapInput}
          validScaleGap={validScaleGap}
          scaleEstimate={scaleEstimate}
          rulerDistanceInput={rulerDistanceInput}
          setRulerDistanceInput={setRulerDistanceInput}
          validRulerDistance={validRulerDistance}
          rulerEstimate={rulerEstimate}
          paperName={paperName}
          observedXmm={observedXmm}
          setObservedXmm={setObservedXmm}
          observedYmm={observedYmm}
          setObservedYmm={setObservedYmm}
          calibrationUpdated={calibrationUpdated}
          setCalibrationUpdated={setCalibrationUpdated}
          calibrationDraft={calibrationDraft}
          setCalibrationDraft={setCalibrationDraft}
          calibrationStorageWarning={calibrationStorageWarning}
          isExporting={isExporting}
          onSelectPrinter={handleSelectPrinter}
          onAddPrinter={handleAddPrinter}
          onRenamePrinter={handleRenamePrinter}
          onDeletePrinter={handleDeletePrinter}
          onResetCalibration={resetCalibration}
          onDownloadCalibrationSheet={handleDownloadCalibrationSheet}
          onApplyObservedCorrection={applyObservedCorrection}
          onCommitCalibrationAxis={commitCalibrationAxis}
        />
      </Dialog>

      {confirmDialog}
      {toastMessage && (
        <Toast
          message={toastMessage}
          actionLabel={translate('undo.button')}
          onAction={undoFromToast}
        />
      )}
    </>
  )
}

export default App
