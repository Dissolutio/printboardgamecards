import { useRef, useState } from 'react'
import AppHeader from './components/AppHeader.tsx'
import CalibrationPanel from './components/CalibrationPanel.tsx'
import CardList from './components/CardList.tsx'
import ExportPanel from './components/ExportPanel.tsx'
import PrintSettingsPanel from './components/PrintSettingsPanel.tsx'
import PrintPreview from './components/PrintPreview.tsx'
import SelectedCardEditor from './components/SelectedCardEditor.tsx'
import StarterDeckPanel from './components/StarterDeckPanel.tsx'
import { useCards } from './hooks/useCards.ts'
import { prepareSideCrop, useProjectIo } from './hooks/useProjectIo.tsx'
import { usePrinterProfiles } from './hooks/usePrinterProfiles.ts'
import {
  useSettings,
  type PresetName,
} from './hooks/useSettings.ts'
import {
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

const SIDES: CardSide[] = ['front', 'back']
const PAPER_OPTIONS: (keyof typeof PAPER)[] = ['LETTER', 'A4']
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

  return (
    <main className="min-h-screen bg-base-200 px-4 py-8 text-base-content sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <AppHeader paperName={paperName} />

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
  )
}

export default App
