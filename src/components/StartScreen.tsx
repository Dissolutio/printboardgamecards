import { useState, type ChangeEvent, type RefObject } from 'react'
import { formatNumber } from '../i18n/numbers.ts'
import { summarizeStartDeck } from '../lib/startScreen.ts'
import type { PieceOrientation, Size } from '../lib/geometry.ts'
import type { ExportMode, PaperName, PresetName } from '../hooks/useSettings.ts'
import type { StarterBackChoice } from './StarterDeckPanel.tsx'
import StarterDeckPanel from './StarterDeckPanel.tsx'

type StartScreenProps = {
  cardSize: Size
  presetName: PresetName
  paperName: PaperName
  exportMode: ExportMode
  pieceOrientation: PieceOrientation
  disabled: boolean
  isLoadingManifest: boolean
  isProcessing: boolean
  progress?: { done: number; total: number }
  error?: string
  onCreate: (options: {
    includeJokers: boolean
    back: StarterBackChoice
  }) => Promise<boolean>
  onOpenProject: (event: ChangeEvent<HTMLInputElement>) => void
  projectFileInput: RefObject<HTMLInputElement | null>
  onStartWithOneCard: () => void
}

function StartScreen({
  cardSize,
  presetName,
  paperName,
  exportMode,
  pieceOrientation,
  disabled,
  isLoadingManifest,
  isProcessing,
  progress,
  error,
  onCreate,
  onOpenProject,
  projectFileInput,
  onStartWithOneCard,
}: StartScreenProps) {
  const [includeJokers, setIncludeJokers] = useState(false)
  const deckCount = includeJokers ? 54 : 52
  const summary = summarizeStartDeck({
    cardCount: deckCount,
    presetName,
    paperName,
    exportMode,
    pieceOrientation,
  })
  const cardWidthMm = formatNumber((cardSize.width * 25.4) / 72, 'en', {
    maximumFractionDigits: 1,
  })
  const cardHeightMm = formatNumber((cardSize.height * 25.4) / 72, 'en', {
    maximumFractionDigits: 1,
  })
  const paperLabel = paperName === 'LETTER' ? 'Letter' : 'A4'

  return (
    <main className="start-screen min-h-screen">
      <header className="start-header">
        <a className="start-brand" href="#start" aria-label="Print Board Game Cards home">
          <svg width="32" height="32" viewBox="0 0 32 32" role="img" aria-label="Logo">
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
          <span>Print Board Game Cards</span>
        </a>
        <nav className="start-nav" aria-label="Help">
          <a href="#how-printing-works">How printing works</a>
          <a href="#printer-calibration">Printer calibration</a>
        </nav>
        <button
          className="btn btn-outline min-h-11 rounded-lg bg-neutral px-4"
          type="button"
          disabled={disabled}
          onClick={() => projectFileInput.current?.click()}
        >
          Open project file
        </button>
      </header>

      <div id="start" className="start-content">
        <div className="start-main-grid">
          <div className="start-intro">
            <section className="start-hero">
              <h1>Print a deck of cards at home.</h1>
              <p>Choose a front set and a back. The app lays out the pages for your printer.</p>
              <div className="card-fan" aria-hidden="true">
                <div className="fan-card fan-card-spade">A<br />♠</div>
                <div className="fan-card fan-card-heart">K<br />♥</div>
                <div className="fan-card fan-card-club">Q<br />♣</div>
                <div className="fan-card fan-card-back" />
              </div>
            </section>

            <section className="start-ways" aria-labelledby="start-ways-title">
              <h2 id="start-ways-title">Or start another way</h2>
              <button
                className="start-way-card"
                type="button"
                onClick={onStartWithOneCard}
              >
                <span>Start with one card</span>
                <small>Add your own images, one card at a time.</small>
              </button>
              <button
                className="start-way-card"
                type="button"
                disabled={disabled}
                onClick={() => projectFileInput.current?.click()}
              >
                <span>Open a project file</span>
                <small>Continue a deck you saved.</small>
              </button>
              {/* RestoreLastProjectSlot stays empty until autosave is available. */}
            </section>
          </div>

          <StarterDeckPanel
            cardSize={cardSize}
            presetName={presetName}
            cardWidthMm={cardWidthMm}
            cardHeightMm={cardHeightMm}
            paperName={paperName}
            disabled={disabled}
            isLoadingManifest={isLoadingManifest}
            isProcessing={isProcessing}
            progress={progress}
            error={error}
            includeJokers={includeJokers}
            onIncludeJokersChange={setIncludeJokers}
            summaryText={summary.text}
            onCreate={onCreate}
          />
        </div>

        <section className="trust-grid" aria-label="Printing information">
          <article className="trust-tile" id="how-printing-works">
            <strong>{formatNumber(summary.cardsPerPage, 'en')}</strong>
            <span>{exportMode === 'PRINT_GLUE' ? 'Card sides per page' : 'Cards per page'}</span>
            <p>
              {exportMode === 'PRINT_GLUE'
                ? `Print and glue on ${paperLabel} paper.`
                : `Double-sided printing on ${paperLabel} paper.`}
            </p>
          </article>
          <article className="trust-tile">
            <strong>Project file</strong>
            <span>Continue your deck later</span>
            <p>Save a project file to keep working on this deck.</p>
          </article>
          <article className="trust-tile" id="printer-calibration">
            <strong>Printer calibration</strong>
            <span>Measure the back offset</span>
            <p>Apply a correction to the printer profile.</p>
          </article>
          <article className="trust-tile">
            <strong>In this browser</strong>
            <span>Your images stay here</span>
            <p>The app processes card images in this browser.</p>
          </article>
        </section>
      </div>

      <input
        ref={projectFileInput}
        className="hidden"
        type="file"
        accept=".json,application/json"
        disabled={disabled}
        onChange={onOpenProject}
      />
    </main>
  )
}

export default StartScreen
