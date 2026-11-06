import type { Dispatch, SetStateAction } from 'react'
import type { CalibrationMm } from '../lib/calibration.ts'
import { calibrationAdvice } from '../lib/calibrationAdvice.ts'
import { parseMeasurement } from '../lib/calibrationInput.ts'
import {
  estimatePrintScale,
  expectedScaleGapSpaces,
  scaleEstimatesDisagree,
  SHEET_WIDTH_MM,
} from '../lib/calibrationScale.ts'
import type { PrinterProfile, PrinterProfiles } from '../lib/printerProfiles.ts'
import type { PrintMode } from '../lib/printSummary.ts'
import { createTranslator } from '../i18n/messages.ts'
import { en } from '../i18n/en.ts'
import { formatNumber, formatPercent } from '../i18n/numbers.ts'
import type { PaperName } from './PrintSettingsPanel.tsx'

type CalibrationDraft = {
  offsetXmm: string
  offsetYmm: string
}

type CalibrationPanelProps = {
  disabled: boolean
  printMode: PrintMode
  printerProfiles: PrinterProfiles
  activeProfile: PrinterProfile
  hasCalibrationScale: boolean
  hasFoldGauge: boolean
  scaleGapInput: string
  setScaleGapInput: (value: string) => void
  validScaleGap: boolean
  scaleEstimate: ReturnType<typeof estimatePrintScale> | undefined
  rulerDistanceInput: string
  setRulerDistanceInput: (value: string) => void
  validRulerDistance: boolean
  rulerEstimate: ReturnType<typeof estimatePrintScale> | undefined
  paperName: PaperName
  observedXmm: string
  setObservedXmm: (value: string) => void
  observedYmm: string
  setObservedYmm: (value: string) => void
  calibrationUpdated: boolean
  setCalibrationUpdated: (value: boolean) => void
  calibrationDraft: CalibrationDraft
  setCalibrationDraft: Dispatch<SetStateAction<CalibrationDraft>>
  calibrationStorageWarning?: string
  isExporting: boolean
  onSelectPrinter: (id: string) => void
  onAddPrinter: () => void
  onRenamePrinter: () => void
  onDeletePrinter: () => void
  onResetCalibration: () => void
  onDownloadCalibrationSheet: () => void
  onApplyObservedCorrection: () => void
  onCommitCalibrationAxis: (axis: keyof CalibrationMm) => void
}

const calibrationNumberFormat = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const calibrationLocale = new Intl.NumberFormat().resolvedOptions().locale
const translate = createTranslator(en, 'en')

export default function CalibrationPanel({
  disabled,
  printMode,
  printerProfiles,
  activeProfile,
  hasCalibrationScale,
  hasFoldGauge,
  scaleGapInput,
  setScaleGapInput,
  validScaleGap,
  scaleEstimate,
  rulerDistanceInput,
  setRulerDistanceInput,
  validRulerDistance,
  rulerEstimate,
  paperName,
  observedXmm,
  setObservedXmm,
  observedYmm,
  setObservedYmm,
  calibrationUpdated,
  setCalibrationUpdated,
  calibrationDraft,
  setCalibrationDraft,
  calibrationStorageWarning,
  isExporting,
  onSelectPrinter,
  onAddPrinter,
  onRenamePrinter,
  onDeletePrinter,
  onResetCalibration,
  onDownloadCalibrationSheet,
  onApplyObservedCorrection,
  onCommitCalibrationAxis,
}: CalibrationPanelProps) {
  const scaleEstimates = [
    {
      method: translate('calibration.scale.fold.heading'),
      estimate: hasFoldGauge ? scaleEstimate : undefined,
    },
    {
      method: translate('calibration.scale.ruler.heading'),
      estimate: rulerEstimate,
    },
  ].filter(
    (
      result,
    ): result is {
      method: string
      estimate: NonNullable<typeof scaleEstimate>
    } => result.estimate !== undefined,
  )
  const scaleGatePassed =
    !hasCalibrationScale ||
    (scaleEstimates.length > 0 &&
      scaleEstimates.every(({ estimate }) => estimate.verdict === 'OK'))
  const advice = calibrationAdvice({
    observedXmm,
    observedYmm,
    cutting:
      printMode === 'TWO_SIDES_MACHINE'
        ? 'TWO_SIDES_MACHINE'
        : 'TWO_SIDES_HAND',
  })

  return (
    <section className="mb-6 space-y-4 rounded-box border border-base-300 bg-base-100 p-5">
      <div>
        <h2 className="text-lg font-semibold">Calibration</h2>
        <p>{translate('calibration.intro')}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="form-control min-w-56 flex-1 sm:max-w-sm">
          <span className="label-text mb-1">Printer profile</span>
          <select
            className="select select-bordered"
            value={activeProfile.id}
            disabled={disabled}
            onChange={(event) => onSelectPrinter(event.currentTarget.value)}
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
          disabled={printerProfiles.profiles.length >= 10 || disabled}
          onClick={onAddPrinter}
        >
          New printer
        </button>
        <button
          className="btn btn-outline"
          type="button"
          disabled={disabled}
          onClick={onRenamePrinter}
        >
          Rename
        </button>
        <button
          className="btn btn-outline btn-error"
          type="button"
          disabled={printerProfiles.profiles.length <= 1 || disabled}
          onClick={onDeletePrinter}
        >
          Delete
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-start gap-3">
        <p>
          Current offset: X {calibrationNumberFormat.format(activeProfile.offsetXmm)} mm, Y{' '}
          {calibrationNumberFormat.format(activeProfile.offsetYmm)} mm
        </p>
        <button className="btn btn-outline" type="button" onClick={onResetCalibration}>
          Reset to 0
        </button>
      </div>

      <ol className="list-decimal space-y-4 pl-5">
        <li>
          <h3 className="mb-2 font-medium">
            {translate('calibration.step.download')}
          </h3>
          <button
            className="btn btn-primary"
            type="button"
            disabled={disabled}
            onClick={onDownloadCalibrationSheet}
          >
            {translate(
              isExporting
                ? 'calibration.download.preparing'
                : 'calibration.download.button',
            )}
          </button>
        </li>
        <li className="space-y-1">
          <h3 className="font-medium">{translate('calibration.step.setup')}</h3>
          <ul className="list-disc space-y-3 pl-5">
            <li>
              <p>{translate('calibration.setup.scale')}</p>
              <p className="text-sm text-base-content/70">
                {translate('calibration.setup.scale.why')}
              </p>
            </li>
            <li>
              <p>{translate('calibration.setup.duplex')}</p>
              <p className="text-sm text-base-content/70">
                {translate('calibration.setup.duplex.why')}
              </p>
            </li>
            <li>
              <p>{translate('calibration.setup.hand')}</p>
              <p className="text-sm text-base-content/70">
                {translate('calibration.setup.hand.why')}
              </p>
            </li>
          </ul>
        </li>
      </ol>
      <ol start={3} className="list-decimal space-y-4 pl-5">
          <li className="space-y-3">
            <h3 className="font-medium">{translate('calibration.step.scale')}</h3>
            {hasCalibrationScale ? (
              <>
            <p>{translate('calibration.scale.intro')}</p>
            {hasFoldGauge && (
              <section className="space-y-3 rounded-box border border-base-300 p-4">
                <h3 className="font-medium">
                  {translate('calibration.scale.fold.heading')}
                </h3>
                <ol className="list-decimal space-y-2 pl-5">
                  <li>{translate('calibration.scale.fold.step1')}</li>
                  <li>{translate('calibration.scale.fold.step2')}</li>
                  <li>{translate('calibration.scale.fold.step3')}</li>
                  <li>{translate('calibration.scale.fold.step4')}</li>
                </ol>
                <label className="form-control max-w-sm gap-1">
                  <span className="label-text">
                    {translate('calibration.scale.fold.input.label')}
                  </span>
                  <input
                    className="input input-bordered min-h-11 w-full"
                    type="number"
                    min={0}
                    step="any"
                    aria-label={translate('calibration.scale.fold.input.label')}
                    aria-describedby="scale-gap-hint"
                    aria-invalid={scaleGapInput.trim() !== '' && !validScaleGap}
                    value={scaleGapInput}
                    onChange={(event) => setScaleGapInput(event.currentTarget.value)}
                  />
                  <span id="scale-gap-hint" className="text-sm">
                    {translate('calibration.scale.fold.input.expected', {
                      value: formatNumber(
                        expectedScaleGapSpaces(SHEET_WIDTH_MM[paperName]),
                        calibrationLocale,
                        { maximumFractionDigits: 1 },
                      ),
                      unit: translate('calibration.scale.fold.unit'),
                      paper: translate(`printSummary.paper.${paperName}`),
                    })}
                  </span>
                  {scaleGapInput.trim() !== '' && !validScaleGap && (
                    <span className="text-sm text-error">
                      {translate('calibration.number.error')}
                    </span>
                  )}
                </label>
              </section>
            )}
            <section className="space-y-3 rounded-box border border-base-300 p-4">
              <h3 className="font-medium">
                {translate('calibration.scale.ruler.heading')}
              </h3>
              <p>
                {translate('calibration.scale.ruler.instruction', {
                  distance: 200,
                  unit: translate('calibration.scale.ruler.unit.mm'),
                  inches: formatNumber(7.87, calibrationLocale, {
                    maximumFractionDigits: 2,
                  }),
                  inchUnit: translate('calibration.scale.ruler.unit.inch'),
                })}
              </p>
              <label className="form-control max-w-sm gap-1">
                <span className="label-text">
                  {translate('calibration.scale.ruler.input.label')}
                </span>
                <input
                  className="input input-bordered min-h-11 w-full"
                  type="text"
                  inputMode="decimal"
                  aria-label={translate('calibration.scale.ruler.input.label')}
                  aria-describedby="ruler-distance-error"
                  aria-invalid={
                    rulerDistanceInput.trim() !== '' && !validRulerDistance
                  }
                  value={rulerDistanceInput}
                  onChange={(event) =>
                    setRulerDistanceInput(event.currentTarget.value)
                  }
                />
                {rulerDistanceInput.trim() !== '' && !validRulerDistance && (
                  <span id="ruler-distance-error" className="text-sm text-error">
                    {translate('calibration.number.error')}
                  </span>
                )}
              </label>
            </section>
            {scaleEstimates.length > 0 && (
              <div className="space-y-2" role="status" aria-live="polite">
                {scaleEstimates.map(({ method, estimate }) => (
                  <div key={method} className="space-y-1">
                    {scaleEstimates.length > 1 && (
                      <p className="font-medium">{method}</p>
                    )}
                    <p>
                      {translate(
                        estimate.verdict === 'OK'
                          ? 'calibration.scale.verdict.ok'
                          : estimate.verdict === 'TOO_SMALL'
                            ? 'calibration.scale.verdict.small'
                            : 'calibration.scale.verdict.large',
                      )}
                    </p>
                    <p>
                      {translate('calibration.scale.estimate', {
                        scale: formatPercent(estimate.scale, calibrationLocale, 1),
                      })}
                    </p>
                  </div>
                ))}
                {hasFoldGauge &&
                  scaleEstimate &&
                  rulerEstimate &&
                  scaleEstimatesDisagree(
                    scaleEstimate.scale,
                    rulerEstimate.scale,
                  ) && (
                    <p>{translate('calibration.scale.disagree')}</p>
                  )}
              </div>
            )}
              </>
            ) : (
              <p>{translate('calibration.scale.unavailable')}</p>
            )}
            {hasCalibrationScale &&
              scaleEstimates.length > 0 &&
              !scaleGatePassed && (
                <p role="status">{translate('calibration.scale.stop')}</p>
              )}
          </li>
      </ol>
      {scaleGatePassed && (
      <ol start={4} className="list-decimal space-y-4 pl-5">
        <li className="space-y-2">
          <h3 className="font-medium">{translate('calibration.step.corners')}</h3>
          <p>{translate('calibration.instructions.cornerMarks')}</p>
          <p>{translate('calibration.instructions.zero')}</p>
          <p>{translate('calibration.instructions.horizontal')}</p>
          <p>{translate('calibration.instructions.fraction')}</p>
          <p>{translate('calibration.instructions.vertical')}</p>
          <p>{translate('calibration.instructions.direction')}</p>
          <p>
            {translate('calibration.instructions.average', {
              limit: formatNumber(0.5, calibrationLocale, {
                maximumFractionDigits: 1,
              }),
              unit: translate('calibration.scale.ruler.unit.mm'),
            })}
          </p>
        </li>
        <li>
          <fieldset className="space-y-3 rounded-box border border-base-300 p-4">
            <legend className="px-1 font-medium">
              {translate('calibration.step.result')}
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="form-control gap-1">
                <span className="label-text">
                  {translate('calibration.offsetX.label')}
                </span>
                <input
                  className="input input-bordered min-h-11 w-full"
                  type="number"
                  step={0.05}
                  aria-label={translate('calibration.offsetX.label')}
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
                  {translate('calibration.offsetX.hint')}
                </span>
                {observedXmm.trim() !== '' &&
                  parseMeasurement(observedXmm) === undefined && (
                    <span className="text-sm text-error">
                      {translate('calibration.number.error')}
                    </span>
                  )}
              </label>
              <label className="form-control gap-1">
                <span className="label-text">
                  {translate('calibration.offsetY.label')}
                </span>
                <input
                className="input input-bordered min-h-11 w-full"
                  type="number"
                  step={0.05}
                  aria-label={translate('calibration.offsetY.label')}
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
                  {translate('calibration.offsetY.hint')}
                </span>
                {observedYmm.trim() !== '' &&
                  parseMeasurement(observedYmm) === undefined && (
                    <span className="text-sm text-error">
                      {translate('calibration.number.error')}
                    </span>
                  )}
              </label>
            </div>
            {advice && (
              <p role="status">
                {translate(
                  advice.kind === 'SKIP'
                    ? 'calibration.advice.skip'
                    : 'calibration.advice.apply',
                )}
              </p>
            )}
            <button
              className={`btn min-h-11 ${
                advice?.kind === 'SKIP'
                  ? 'btn-outline btn-secondary'
                  : 'btn-primary'
              }`}
              type="button"
              disabled={
                parseMeasurement(observedXmm) === undefined ||
                parseMeasurement(observedYmm) === undefined ||
                disabled
              }
              onClick={onApplyObservedCorrection}
            >
              {translate('calibration.apply.button')}
            </button>
          </fieldset>
        </li>
      </ol>
      )}
      {calibrationUpdated && (
        <p className="text-sm text-success" role="status">
          {translate('calibration.offset.updated')}
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
                setCalibrationDraft((current) => ({ ...current, offsetXmm: value }))
                setCalibrationUpdated(false)
              }}
              onBlur={() => onCommitCalibrationAxis('offsetXmm')}
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
                setCalibrationDraft((current) => ({ ...current, offsetYmm: value }))
                setCalibrationUpdated(false)
              }}
              onBlur={() => onCommitCalibrationAxis('offsetYmm')}
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
  )
}
