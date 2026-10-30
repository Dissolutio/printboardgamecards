import type { ChangeEvent, RefObject } from 'react'
import { totalCopies } from '../lib/deck.ts'
import type { ExportKind, PrinterProfile } from '../lib/printerProfiles.ts'
import { hasCalibration } from '../lib/printerProfiles.ts'
import type { Card } from '../types.ts'

type ExportMode = 'PRINT_GLUE' | 'DUPLEX'

type ExportPanelProps = {
  cards: Card[]
  pageCount: number
  exportMode: ExportMode
  activeProfile: PrinterProfile
  calibratedDownloadNeedsOffsets: boolean
  disabled: boolean
  isExporting: boolean
  isSavingProject: boolean
  isLoadingProject: boolean
  exportError?: string
  projectFileInput: RefObject<HTMLInputElement | null>
  onDownload: () => void
  onDownloadDuplex: (kind: ExportKind) => void
  onSaveProject: () => void
  onLoadProject: (event: ChangeEvent<HTMLInputElement>) => void
}

export default function ExportPanel({
  cards,
  pageCount,
  exportMode,
  activeProfile,
  calibratedDownloadNeedsOffsets,
  disabled,
  isExporting,
  isSavingProject,
  isLoadingProject,
  exportError,
  projectFileInput,
  onDownload,
  onDownloadDuplex,
  onSaveProject,
  onLoadProject,
}: ExportPanelProps) {
  return (
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
            disabled={pageCount === 0 || disabled}
            onClick={onDownload}
          >
            {isExporting ? 'Preparing PDF…' : 'Download PDF'}
          </button>
        ) : (
          <>
            <button
              className="btn btn-primary"
              type="button"
              disabled={pageCount === 0 || disabled}
              onClick={() => onDownloadDuplex('ORIGINAL')}
            >
              {isExporting ? 'Preparing PDF…' : 'Download PDF (original, shareable)'}
            </button>
            <button
              className="btn btn-outline"
              type="button"
              disabled={pageCount === 0 || !hasCalibration(activeProfile) || disabled}
              title={
                calibratedDownloadNeedsOffsets
                  ? 'Set offsets in the calibration section to enable this.'
                  : undefined
              }
              onClick={() => onDownloadDuplex('CALIBRATED')}
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
          disabled={disabled}
          onClick={onSaveProject}
        >
          {isSavingProject ? 'Saving…' : 'Save project'}
        </button>
        <button
          className="btn btn-outline"
          type="button"
          disabled={disabled}
          onClick={() => projectFileInput.current?.click()}
        >
          {isLoadingProject ? 'Loading...' : 'Load project'}
        </button>
        <input
          ref={projectFileInput}
          className="hidden"
          type="file"
          accept=".json,application/json"
          disabled={disabled}
          onChange={onLoadProject}
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
  )
}
