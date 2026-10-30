import { PAPER } from '../lib/geometry.ts'

type PaperName = keyof typeof PAPER

type AppHeaderProps = {
  paperName: PaperName
  canUndo: boolean
  canRedo: boolean
  historyDisabled: boolean
  undoLabel: string
  redoLabel: string
  onUndo: () => void
  onRedo: () => void
}

export default function AppHeader({
  paperName,
  canUndo,
  canRedo,
  historyDisabled,
  undoLabel,
  redoLabel,
  onUndo,
  onRedo,
}: AppHeaderProps) {
  const paper = PAPER[paperName]

  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">
          Printboard Game Cards
        </p>
        <h1 className="mt-1 text-3xl font-bold">Card deck editor</h1>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex gap-2">
          <button
            className="btn btn-outline min-h-11 px-3"
            type="button"
            disabled={historyDisabled || !canUndo}
            onClick={onUndo}
          >
            {undoLabel}
          </button>
          <button
            className="btn btn-outline min-h-11 px-3"
            type="button"
            disabled={historyDisabled || !canRedo}
            onClick={onRedo}
          >
            {redoLabel}
          </button>
        </div>
        <p className="text-sm text-base-content/60">
          {paperName === 'LETTER' ? 'Letter' : 'A4'} paper · {paper.width} × {paper.height} pt
        </p>
      </div>
    </header>
  )
}
