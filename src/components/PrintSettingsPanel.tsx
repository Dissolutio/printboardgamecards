import {
  CARD_PRESETS,
  PAPER,
  type PieceOrientation,
} from '../lib/geometry.ts'

type PaperName = keyof typeof PAPER
type PresetName = keyof typeof CARD_PRESETS
type ExportMode = 'PRINT_GLUE' | 'DUPLEX'

type PrintSettingsPanelProps = {
  presetName: PresetName
  paperName: PaperName
  exportMode: ExportMode
  pieceOrientation: PieceOrientation
  disabled: boolean
  loadingProject: boolean
  onPresetChange: (value: string) => void
  onPaperChange: (value: string) => void
  onExportModeChange: (value: string) => void
  onPieceOrientationChange: (value: string) => void
}

export default function PrintSettingsPanel({
  presetName,
  paperName,
  exportMode,
  pieceOrientation,
  disabled,
  loadingProject,
  onPresetChange,
  onPaperChange,
  onExportModeChange,
  onPieceOrientationChange,
}: PrintSettingsPanelProps) {
  return (
    <section className="mb-6 rounded-box border border-base-300 bg-base-100 p-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <label className="form-control">
          <span className="label-text mb-1">Card preset</span>
          <select
            className="select select-bordered w-full"
            value={presetName}
            disabled={disabled}
            onChange={(event) => onPresetChange(event.currentTarget.value)}
          >
            {Object.keys(CARD_PRESETS).map((name) => (
              <option key={name} value={name}>
                {name.charAt(0) + name.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="form-control">
          <span className="label-text mb-1">Paper size</span>
          <select
            className="select select-bordered w-full"
            value={paperName}
            disabled={disabled}
            onChange={(event) => onPaperChange(event.currentTarget.value)}
          >
            {(['LETTER', 'A4'] as const).map((option) => (
              <option key={option} value={option}>
                {option === 'LETTER' ? 'Letter' : 'A4'}
              </option>
            ))}
          </select>
        </label>
        <label className="form-control">
          <span className="label-text mb-1">Print mode</span>
          <select
            className="select select-bordered w-full"
            value={exportMode}
            disabled={disabled}
            onChange={(event) => onExportModeChange(event.currentTarget.value)}
          >
            <option value="PRINT_GLUE">Single-sided (print, cut, glue)</option>
            <option value="DUPLEX">Double-sided hand-cut</option>
          </select>
        </label>
        {exportMode === 'PRINT_GLUE' && (
          <label className="form-control">
            <span className="label-text mb-1">Piece orientation</span>
            <select
              className="select select-bordered w-full"
              value={pieceOrientation}
              disabled={loadingProject}
              onChange={(event) => onPieceOrientationChange(event.currentTarget.value)}
            >
              <option value="AUTO">Auto</option>
              <option value="UPRIGHT">Upright</option>
              <option value="ROTATED">Rotated</option>
            </select>
          </label>
        )}
      </div>
    </section>
  )
}
