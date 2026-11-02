import type { Dispatch, SetStateAction } from 'react'
import type { CalibrationMm } from '../lib/calibration.ts'
import { parseMeasurement } from '../lib/calibrationInput.ts'
import {
  estimatePrintScale,
  expectedScaleGapSpaces,
  scaleEstimatesDisagree,
  SHEET_WIDTH_MM,
} from '../lib/calibrationScale.ts'
import type { PrinterProfile, PrinterProfiles } from '../lib/printerProfiles.ts'
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

  return (
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
          <button
            className="btn btn-primary"
            type="button"
            disabled={disabled}
            onClick={onDownloadCalibrationSheet}
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
          <li className="space-y-3">
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
          </li>
        </ol>
      ) : (
        <p>{translate('calibration.scale.unavailable')}</p>
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
                disabled
              }
              onClick={onApplyObservedCorrection}
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
