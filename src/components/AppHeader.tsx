import { PAPER } from '../lib/geometry.ts'

type PaperName = keyof typeof PAPER

export default function AppHeader({ paperName }: { paperName: PaperName }) {
  const paper = PAPER[paperName]

  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">
          Printboard Game Cards
        </p>
        <h1 className="mt-1 text-3xl font-bold">Card deck editor</h1>
      </div>
      <p className="text-sm text-base-content/60">
        {paperName === 'LETTER' ? 'Letter' : 'A4'} paper · {paper.width} × {paper.height} pt
      </p>
    </header>
  )
}
