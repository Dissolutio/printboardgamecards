import { formatNumber } from '../i18n/numbers.ts'
import { printSummaryLabels } from '../lib/printSummaryLabels.ts'
import type { ModeSummary, PrintMode } from '../lib/printSummary.ts'
import {
  CARD_PRESETS,
  PAPER,
  type PieceOrientation,
} from '../lib/geometry.ts'

export type PaperName = keyof typeof PAPER
export type PresetName = keyof typeof CARD_PRESETS

type PrintSettingsPanelProps = {
  presetName: PresetName
  paperName: PaperName
  printMode: PrintMode
  pieceOrientation: PieceOrientation
  summaries: Record<PrintMode, ModeSummary>
  autoSummary: ModeSummary
  cardCount: number
  disabled: boolean
  loadingProject: boolean
  onPresetChange: (value: string) => void
  onPaperChange: (value: string) => void
  onPrintModeChange: (value: PrintMode) => void
  onPieceOrientationChange: (value: string) => void
}

const PRINT_MODES: Array<{
  value: PrintMode
  label: string
}> = [
  { value: 'ONE_SIDE_GLUE', label: 'Print one side, cut, and glue' },
  { value: 'TWO_SIDES_HAND', label: 'Print two sides, cut by hand' },
  { value: 'TWO_SIDES_MACHINE', label: 'Print two sides, cut with a machine' },
]

function cardPresetLabel(name: PresetName, locale: string): string {
  const size = CARD_PRESETS[name]
  const width = formatNumber((size.width * 25.4) / 72, locale, {
    maximumFractionDigits: 1,
  })
  const height = formatNumber((size.height * 25.4) / 72, locale, {
    maximumFractionDigits: 1,
  })
  const displayName = name.charAt(0) + name.slice(1).toLowerCase()
  return `${displayName}, ${width} by ${height} mm`
}

export default function PrintSettingsPanel({
  presetName,
  paperName,
  printMode,
  pieceOrientation,
  summaries,
  autoSummary,
  cardCount,
  disabled,
  loadingProject,
  onPresetChange,
  onPaperChange,
  onPrintModeChange,
  onPieceOrientationChange,
}: PrintSettingsPanelProps) {
  const locale = new Intl.NumberFormat().resolvedOptions().locale
  const autoOrientation = autoSummary.rotated ? 'Landscape' : 'Portrait'
  const autoCardsPerPage = formatNumber(autoSummary.cardsPerPage, locale)
  const autoLabel = `Auto (${autoOrientation}, ${autoCardsPerPage} cards per page)`

  return (
    <section className="space-y-4 rounded-[14px] border border-base-300 bg-base-100 p-5">
      <h2 className="m-0 text-lg font-semibold">Print settings</h2>
      <label className="form-control">
        <span className="label-text mb-1">Paper size</span>
        <select
          className="select select-bordered min-h-11 w-full"
          value={paperName}
          disabled={disabled}
          onChange={(event) => onPaperChange(event.currentTarget.value)}
        >
          {(['LETTER', 'A4'] as const).map((paper) => (
            <option key={paper} value={paper}>
              {paper === 'LETTER' ? 'Letter' : 'A4'}
            </option>
          ))}
        </select>
      </label>

      <label className="form-control">
        <span className="label-text mb-1">Card size</span>
        <select
          className="select select-bordered min-h-11 w-full"
          value={presetName}
          disabled={disabled}
          onChange={(event) => onPresetChange(event.currentTarget.value)}
        >
          {Object.keys(CARD_PRESETS).map((name) => {
            const preset = name as PresetName
            return (
              <option key={name} value={name}>
                {cardPresetLabel(preset, locale)}
              </option>
            )
          })}
        </select>
      </label>

      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 text-sm text-base-content/70">
          How will you print?
        </legend>
        {PRINT_MODES.map(({ value, label }) => {
          const modeLine = printSummaryLabels(
            summaries[value],
            cardCount,
            locale,
          ).modeLine
          return (
            <label
              key={value}
              className={`flex min-h-11 cursor-pointer items-start gap-2.5 rounded-[10px] border p-2.5 ${
                printMode === value
                  ? 'border-2 border-secondary bg-neutral'
                  : 'border-base-300'
              }`}
            >
              <input
                className="radio radio-secondary mt-0.5 shrink-0"
                type="radio"
                name="print-mode"
                value={value}
                checked={printMode === value}
                disabled={disabled}
                onChange={() => onPrintModeChange(value)}
              />
              <span className="min-w-0 text-sm">
                <span className="block">{label}</span>
                <span className="block text-xs text-base-content/70">
                  {modeLine}
                </span>
              </span>
            </label>
          )
        })}
      </fieldset>

      {printMode === 'ONE_SIDE_GLUE' && (
        <>
          <label className="form-control">
            <span className="label-text mb-1">Card orientation on the page</span>
            <select
              className="select select-bordered min-h-11 w-full"
              value={pieceOrientation}
              disabled={loadingProject}
              onChange={(event) => onPieceOrientationChange(event.currentTarget.value)}
            >
              <option value="AUTO">{autoLabel}</option>
              <option value="UPRIGHT">Portrait</option>
              <option value="ROTATED">Landscape</option>
            </select>
          </label>
          <p className="m-0 text-sm text-base-content/70">
            This setting changes the cards, not the paper.
          </p>
        </>
      )}
    </section>
  )
}
