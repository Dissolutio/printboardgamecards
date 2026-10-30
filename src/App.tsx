import { useEffect, useRef, useState } from 'react'
import AppHeader from './components/AppHeader.tsx'
import StartScreen from './components/StartScreen.tsx'
import CalibrationPanel from './components/CalibrationPanel.tsx'
import CardList from './components/CardList.tsx'
import ExportPanel from './components/ExportPanel.tsx'
import PrintSettingsPanel from './components/PrintSettingsPanel.tsx'
import PrintPreview from './components/PrintPreview.tsx'
import SelectedCardEditor from './components/SelectedCardEditor.tsx'
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
import type { BleedMode, CardSide } from './types.ts'
import { createTranslator } from './i18n/messages.ts'
import { en } from './i18n/en.ts'
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
  const [toastMessage, setToastMessage] = useState<string>()
  const toastTimer = useRef<number | undefined>(undefined)
  const historyBusyRef = useRef(false)
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

  useEffect(() => {
    if (chooseScreen(cards) === 'workspace') setScreen('workspace')
  }, [cards])

  function updateSettings(next: Partial<HistorySettings>) {
    const updated = cardState.commitSettings(next)
    if (next.presetName !== undefined) setPresetName(updated.presetName)
    if (next.paperName !== undefined) setPaperName(updated.paperName)
    if (next.exportMode !== undefined) setExportMode(updated.exportMode)
    if (next.pieceOrientation !== undefined) {
      setPieceOrientation(updated.pieceOrientation)
    }
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
    confirm,
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
  useEffect(() => {
    historyBusyRef.current = historyBusy
  }, [historyBusy])
  const isProjectControlsDisabled =
    isChangingPreset || isSavingProject || isLoadingProject || isExporting || isCreatingStarterDeck
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
    setErrors({ front: undefined, back: undefined })
    setScreen('start')
    showUndoToast('undo.toast.starterDeckCreated')
  }

  return (
    <>
      {screen === 'start' ? (
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
        <main className="min-h-screen bg-base-200 px-4 py-8 text-base-content sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <AppHeader
              paperName={paperName}
              canUndo={cardState.canUndo}
              canRedo={cardState.canRedo}
              historyDisabled={historyBusy}
              undoLabel={translate('undo.button')}
              redoLabel={translate('redo.button')}
              onUndo={cardState.undo}
              onRedo={cardState.redo}
              onNewDeck={() => void handleStartNewDeck()}
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
            if (selectedPaper) updateSettings({ paperName: selectedPaper })
          }}
          onExportModeChange={(value) =>
            updateSettings({
              exportMode: value === 'DUPLEX' ? 'DUPLEX' : 'PRINT_GLUE',
            })
          }
          onPieceOrientationChange={(value) =>
            updateSettings({
              pieceOrientation:
                value === 'UPRIGHT' || value === 'ROTATED' ? value : 'AUTO',
            })
          }
        />

        {exportMode === 'DUPLEX' && (
          <CalibrationPanel
            disabled={isProjectControlsDisabled}
            printerProfiles={printerProfiles}
            activeProfile={activeProfile}
            hasCalibrationScale={hasCalibrationScale}
            scaleGapInput={scaleGapInput}
            setScaleGapInput={setScaleGapInput}
            validScaleGap={validScaleGap}
            scaleEstimate={scaleEstimate}
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
      )}
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
