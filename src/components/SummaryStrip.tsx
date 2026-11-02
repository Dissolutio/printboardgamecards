import { printSummaryLabels } from '../lib/printSummaryLabels.ts'
import type { ModeSummary, PrintMode } from '../lib/printSummary.ts'

type SummaryStripProps = {
  summaries: Record<PrintMode, ModeSummary>
  mode: PrintMode
  cardCount: number
  layoutDescription: string
}

export default function SummaryStrip({
  summaries,
  mode,
  cardCount,
  layoutDescription,
}: SummaryStripProps) {
  const summary = summaries[mode]
  const labels = printSummaryLabels(
    summary,
    cardCount,
    new Intl.NumberFormat().resolvedOptions().locale,
  )

  return (
    <section
      aria-label="Print summary"
      className="sticky top-0 z-30 flex flex-wrap items-center gap-x-7 gap-y-2 border-b border-base-300 bg-base-100 px-4 py-3 sm:px-8"
    >
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-accent">{labels.firstCount}</span>
        <span>{labels.firstLabel}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-accent">{labels.secondCount}</span>
        <span>{labels.secondLabel}</span>
      </div>
      <p className="m-0 min-w-0 flex-1 text-sm text-base-content/70">
        {layoutDescription}
      </p>
      <a
        className="inline-flex min-h-11 shrink-0 items-center text-sm"
        href="#print-preview"
      >
        See the pages
      </a>
    </section>
  )
}
