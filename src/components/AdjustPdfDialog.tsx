import type { ChangeEvent, ComponentProps, DragEvent } from 'react'
import CalibrationPanel from './CalibrationPanel.tsx'
import { Dialog } from './Dialog.tsx'
import { createTranslator } from '../i18n/messages.ts'
import { en } from '../i18n/en.ts'
import { formatNumber, parseLocaleNumber } from '../i18n/numbers.ts'
import { parseMeasurement } from '../lib/calibrationInput.ts'
import {
  calibrationScaleGaugeY,
  calibrationScaleY,
  estimatePrintScale,
  estimatePrintScaleFromRuler,
  SHEET_WIDTH_MM,
} from '../lib/calibrationScale.ts'
import {
  calculateGrid,
  CARD_PRESETS,
  DEFAULT_BLEED,
  PAPER,
} from '../lib/geometry.ts'
import { exportCalibrationPt } from '../lib/printerProfiles.ts'
import type { PaperName, PresetName } from '../hooks/useSettings.ts'
import type { AdjustPdfErrorCode } from '../lib/adjustDuplexPdf.ts'

const translate = createTranslator(en, 'en')
const presetLabelKeys: Record<PresetName, keyof typeof en> = {
  POKER: 'adjustPdf.cardSize.poker',
  BRIDGE: 'adjustPdf.cardSize.bridge',
  MINI: 'adjustPdf.cardSize.mini',
  TAROT: 'adjustPdf.cardSize.tarot',
}
type CalibrationPanelState = Omit<
  ComponentProps<typeof CalibrationPanel>,
  | 'hasCalibrationScale'
  | 'hasFoldGauge'
  | 'scaleEstimate'
  | 'validScaleGap'
  | 'validRulerDistance'
  | 'rulerEstimate'
  | 'paperName'
  | 'onDownloadCalibrationSheet'
>

const errorMessageKeys: Record<AdjustPdfErrorCode, keyof typeof en> = {
  NOT_A_PDF: 'adjustPdf.error.notAPdf',
  ENCRYPTED_NEEDS_PASSWORD: 'adjustPdf.error.encrypted',
  EMPTY: 'adjustPdf.error.empty',
  ROTATED_PAGES_UNSUPPORTED: 'adjustPdf.error.rotated',
  ANNOTATIONS_UNSUPPORTED: 'adjustPdf.error.annotations',
  TOO_LARGE: 'adjustPdf.error.tooLarge',
}

function adjustedPdfFilename(fileName: string): string {
  const baseName = fileName.replace(/\.pdf$/i, '')
  return `${baseName || fileName}-adjusted.pdf`
}

type AdjustPdfDialogProps = {
  open: boolean
  onClose: () => void
  paperName: PaperName
  onPaperNameChange: (paperName: PaperName) => void
  presetName: PresetName
  onPresetNameChange: (presetName: PresetName) => void
  calibration: CalibrationPanelState
  onDownloadCalibrationSheet: (
    paperName: PaperName,
    presetName: PresetName,
  ) => void
  calibrationError?: string
  file: File | null
  onFileSelect: (file: File | null) => void
  firstPageIsFront: boolean
  onFirstPageIsFrontChange: (value: boolean) => void
  onAdjust: () => void
  isAdjusting: boolean
  result?: { href: string; fileName: string; shiftedPageCount: number }
  errorCode?: AdjustPdfErrorCode
}

const AdjustPdfDialog = Object.assign(function AdjustPdfDialog({
  open,
  onClose,
  paperName,
  onPaperNameChange,
  presetName,
  onPresetNameChange,
  calibration,
  onDownloadCalibrationSheet,
  calibrationError,
  file,
  onFileSelect,
  firstPageIsFront,
  onFirstPageIsFrontChange,
  onAdjust,
  isAdjusting,
  result,
  errorCode,
}: AdjustPdfDialogProps) {
  const paper = PAPER[paperName]
  const cardSize = CARD_PRESETS[presetName]
  const grid = calculateGrid({ paper, card: cardSize, bleed: DEFAULT_BLEED })
  const calibrationPt = exportCalibrationPt('CALIBRATED', calibration.activeProfile)
  const hasCalibrationScale =
    calibrationScaleY({
      paper,
      grid,
      cardSize,
      backOffsetY: calibrationPt.offsetY,
    }) !== null
  const hasFoldGauge =
    calibrationScaleGaugeY({
      paper,
      grid,
      cardSize,
      backOffsetY: calibrationPt.offsetY,
    }) !== null
  const gap = parseMeasurement(calibration.scaleGapInput)
  const validScaleGap = gap !== undefined && gap >= 0
  const scaleEstimate =
    validScaleGap && gap !== undefined
      ? estimatePrintScale({ sheetWidthMm: SHEET_WIDTH_MM[paperName], gapSpaces: gap })
      : undefined
  const rulerDistance = parseLocaleNumber(
    calibration.rulerDistanceInput,
    new Intl.NumberFormat().resolvedOptions().locale,
  )
  const validRulerDistance =
    rulerDistance !== undefined && rulerDistance > 0
  const rulerEstimate =
    validRulerDistance && rulerDistance !== undefined
      ? estimatePrintScaleFromRuler(rulerDistance)
      : undefined
  const offsetIsZero =
    calibration.activeProfile.offsetXmm === 0 &&
    calibration.activeProfile.offsetYmm === 0
  const locale = new Intl.NumberFormat().resolvedOptions().locale
  const formatOffset = (value: number) =>
    formatNumber(value, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    onFileSelect(event.currentTarget.files?.[0] ?? null)
    event.currentTarget.value = ''
  }
  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    onFileSelect(event.dataTransfer.files[0] ?? null)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={translate('adjustPdf.dialog.title')}
      fullScreenOnPhone
      footer={
        <div className="flex justify-end">
          <button
            className="btn btn-outline min-h-11"
            type="button"
            onClick={onClose}
          >
            {translate('adjustPdf.close')}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="form-control">
            <span className="label-text mb-1">
              {translate('adjustPdf.paper.label')}
            </span>
            <select
              className="select select-bordered min-h-11 w-full"
              value={paperName}
              onChange={(event) =>
                onPaperNameChange(event.currentTarget.value as PaperName)
              }
            >
              <option value="LETTER">{translate('printSummary.paper.LETTER')}</option>
              <option value="A4">{translate('printSummary.paper.A4')}</option>
            </select>
          </label>
          <label className="form-control">
            <span className="label-text mb-1">
              {translate('adjustPdf.cardSize.label')}
            </span>
            <select
              className="select select-bordered min-h-11 w-full"
              value={presetName}
              onChange={(event) =>
                onPresetNameChange(event.currentTarget.value as PresetName)
              }
            >
              {Object.keys(CARD_PRESETS).map((name) => (
                <option key={name} value={name}>
                  {translate(presetLabelKeys[name as PresetName])}
                </option>
              ))}
            </select>
          </label>
        </div>
        <CalibrationPanel
          {...calibration}
          hasCalibrationScale={hasCalibrationScale}
          hasFoldGauge={hasFoldGauge}
          scaleEstimate={scaleEstimate}
          validScaleGap={validScaleGap}
          validRulerDistance={validRulerDistance}
          rulerEstimate={rulerEstimate}
          paperName={paperName}
          isExporting={calibration.isExporting || isAdjusting}
          onDownloadCalibrationSheet={() =>
            onDownloadCalibrationSheet(paperName, presetName)
          }
        />
        {calibrationError && (
          <p className="text-sm text-error" role="alert">
            {calibrationError}
          </p>
        )}
        <section className="space-y-3 rounded-box border border-base-300 bg-base-100 p-5">
          <h3 className="text-lg font-semibold">
            {translate('adjustPdf.file.label')}
          </h3>
          <label
            className="block rounded-box border border-dashed border-base-300 p-4"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            <span className="block">{translate('adjustPdf.file.prompt')}</span>
            <span className="mt-1 block text-sm text-base-content/70">
              {file?.name ?? translate('adjustPdf.file.empty')}
            </span>
            <input
              className="sr-only"
              type="file"
              accept=".pdf,application/pdf"
              aria-label={translate('adjustPdf.file.choose')}
              onChange={handleFileInput}
            />
            <span className="btn btn-outline mt-3 min-h-11">
              {translate('adjustPdf.file.choose')}
            </span>
          </label>
          <label className="flex min-h-11 items-center gap-3">
            <input
              className="checkbox checkbox-secondary"
              type="checkbox"
              checked={firstPageIsFront}
              onChange={(event) =>
                onFirstPageIsFrontChange(event.currentTarget.checked)
              }
            />
            <span>{translate('adjustPdf.firstPageIsFront')}</span>
          </label>
          <p>
            {translate(
              firstPageIsFront
                ? 'adjustPdf.note.pages.front'
                : 'adjustPdf.note.pages.back',
            )}
          </p>
          <p>
            {translate('adjustPdf.note.offset', {
              x: formatOffset(calibration.activeProfile.offsetXmm),
              y: formatOffset(calibration.activeProfile.offsetYmm),
            })}
          </p>
          {offsetIsZero && (
            <p role="status">{translate('adjustPdf.noCorrection')}</p>
          )}
          <button
            className={`btn min-h-11 ${
              offsetIsZero ? 'btn-outline btn-secondary' : 'btn-primary'
            }`}
            type="button"
            disabled={!file || isAdjusting}
            onClick={onAdjust}
          >
            {translate(
              isAdjusting ? 'adjustPdf.adjust.working' : 'adjustPdf.adjust.button',
            )}
          </button>
          <p className="text-sm text-base-content/70">
            {translate('adjustPdf.adjust.testSheet')}
          </p>
          {errorCode && (
            <p className="text-sm text-error" role="alert">
              {translate(errorMessageKeys[errorCode])}
            </p>
          )}
          {result && (
            <div className="space-y-1" role="status">
              <a className="link link-primary" href={result.href} download={result.fileName}>
                {result.fileName}
              </a>
              <p>
                {translate('adjustPdf.success.summary', {
                  count: result.shiftedPageCount,
                })}
              </p>
            </div>
          )}
        </section>
      </div>
    </Dialog>
  )
}, { adjustedPdfFilename })

export default AdjustPdfDialog
