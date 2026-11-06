import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import AdjustPdfDialog from './AdjustPdfDialog.tsx'
import type { AdjustPdfErrorCode } from '../lib/adjustDuplexPdf.ts'

const profile = {
  id: 'printer',
  name: 'Printer',
  offsetXmm: 1.25,
  offsetYmm: -0.5,
}

function renderDialog({
  file = null,
  result,
  errorCode,
  offsets = profile,
}: {
  file?: File | null
  result?: { href: string; fileName: string; shiftedPageCount: number }
  errorCode?: AdjustPdfErrorCode
  offsets?: typeof profile
} = {}) {
  return renderToStaticMarkup(
    <AdjustPdfDialog
      open
      onClose={() => {}}
      paperName="LETTER"
      onPaperNameChange={() => {}}
      presetName="POKER"
      onPresetNameChange={() => {}}
      calibration={{
        disabled: false,
        printMode: 'TWO_SIDES_HAND',
        printerProfiles: { profiles: [offsets], activeId: offsets.id },
        activeProfile: offsets,
        scaleGapInput: '',
        setScaleGapInput: () => {},
        rulerDistanceInput: '',
        setRulerDistanceInput: () => {},
        observedXmm: '',
        setObservedXmm: () => {},
        observedYmm: '',
        setObservedYmm: () => {},
        calibrationUpdated: false,
        setCalibrationUpdated: () => {},
        calibrationDraft: { offsetXmm: '0.00', offsetYmm: '0.00' },
        setCalibrationDraft: () => {},
        isExporting: false,
        onSelectPrinter: () => {},
        onAddPrinter: () => {},
        onRenamePrinter: () => {},
        onDeletePrinter: () => {},
        onResetCalibration: () => {},
        onApplyObservedCorrection: () => {},
        onCommitCalibrationAxis: () => {},
      }}
      onDownloadCalibrationSheet={() => {}}
      file={file}
      onFileSelect={() => {}}
      firstPageIsFront
      onFirstPageIsFrontChange={() => {}}
      onAdjust={() => {}}
      isAdjusting={false}
      result={result}
      errorCode={errorCode}
    />,
  )
}

describe('AdjustPdfDialog', () => {
  it('shows the empty file state and calibration advice', () => {
    const markup = renderDialog({
      offsets: { ...profile, offsetXmm: 0, offsetYmm: 0 },
    })

    expect(markup).toContain('Choose a PDF file to adjust.')
    expect(markup).toContain('Your printer may already be accurate.')
    expect(markup).toContain('Run the calibration first, or download an unchanged copy.')
  })

  it('shows the selected file and an available adjustment action', () => {
    const markup = renderDialog({
      file: new File([], 'cards.pdf', { type: 'application/pdf' }),
    })

    expect(markup).toContain('cards.pdf')
    expect(markup).toContain('Adjust PDF')
    expect(markup).toContain('Page 1 is a front')
  })

  it('shows the download link and moved-page summary after success', () => {
    const markup = renderDialog({
      file: new File([], 'cards.pdf', { type: 'application/pdf' }),
      result: {
        href: 'blob:adjusted',
        fileName: 'cards-adjusted.pdf',
        shiftedPageCount: 26,
      },
    })

    expect(markup).toContain('download="cards-adjusted.pdf"')
    expect(markup).toContain('Moved 26 back pages.')
  })

  it.each([
    ['NOT_A_PDF', 'This file is not a valid PDF.'],
    ['ENCRYPTED_NEEDS_PASSWORD', 'Save a copy without a password'],
    ['EMPTY', 'This PDF has no pages.'],
    ['ROTATED_PAGES_UNSUPPORTED', 'This PDF has rotated pages.'],
    ['ANNOTATIONS_UNSUPPORTED', 'This PDF has annotations'],
    ['TOO_LARGE', 'This PDF exceeds the size limit.'],
  ] as const)(
    'shows the catalog message for %s',
    (errorCode, message) => {
      expect(renderDialog({ errorCode })).toContain(message)
    },
  )

  it('builds the download name from the original PDF name', () => {
    expect(AdjustPdfDialog.adjustedPdfFilename('board-game.PDF')).toBe(
      'board-game-adjusted.pdf',
    )
  })

  it('keeps the adjustment action secondary when the offset is zero', () => {
    const markup = renderDialog({
      offsets: { ...profile, offsetXmm: 0, offsetYmm: 0 },
      file: new File([], 'cards.pdf', { type: 'application/pdf' }),
    })

    expect(markup).toContain('Your printer profile has no correction yet.')
    expect(markup).toContain('btn-outline btn-secondary')
  })
})
