import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import CalibrationPanel from './CalibrationPanel.tsx'
import type { PrintMode } from '../lib/printSummary.ts'

function renderPanel({
  printMode = 'TWO_SIDES_HAND',
  hasCalibrationScale = true,
  rulerEstimate,
  observedXmm = '',
  observedYmm = '',
}: {
  printMode?: PrintMode
  hasCalibrationScale?: boolean
  rulerEstimate?: { scale: number; verdict: 'OK' | 'TOO_SMALL' | 'TOO_LARGE' }
  observedXmm?: string
  observedYmm?: string
} = {}) {
  return renderToStaticMarkup(
    <CalibrationPanel
      disabled={false}
      printMode={printMode}
      printerProfiles={{
        profiles: [{ id: 'printer', name: 'Printer', offsetXmm: 0, offsetYmm: 0 }],
        activeId: 'printer',
      }}
      activeProfile={{ id: 'printer', name: 'Printer', offsetXmm: 0, offsetYmm: 0 }}
      hasCalibrationScale={hasCalibrationScale}
      hasFoldGauge={false}
      scaleGapInput=""
      setScaleGapInput={() => {}}
      validScaleGap={false}
      scaleEstimate={undefined}
      rulerDistanceInput=""
      setRulerDistanceInput={() => {}}
      validRulerDistance={false}
      rulerEstimate={rulerEstimate}
      paperName="LETTER"
      observedXmm={observedXmm}
      setObservedXmm={() => {}}
      observedYmm={observedYmm}
      setObservedYmm={() => {}}
      calibrationUpdated={false}
      setCalibrationUpdated={() => {}}
      calibrationDraft={{ offsetXmm: '0.00', offsetYmm: '0.00' }}
      setCalibrationDraft={() => {}}
      isExporting={false}
      onSelectPrinter={() => {}}
      onAddPrinter={() => {}}
      onRenamePrinter={() => {}}
      onDeletePrinter={() => {}}
      onResetCalibration={() => {}}
      onDownloadCalibrationSheet={() => {}}
      onApplyObservedCorrection={() => {}}
      onCommitCalibrationAxis={() => {}}
    />,
  )
}

describe('CalibrationPanel', () => {
  it('orders setup, scale, corner, and result steps after downloading the sheet', () => {
    const markup = renderPanel({ hasCalibrationScale: false })
    const stepLabels = [
      'Download the sheet',
      'Set up the print',
      'Check the printer scale',
      'Read the corners',
      'Result',
    ]

    expect(stepLabels.map((label) => markup.indexOf(label))).toEqual(
      [...stepLabels].map((label) => markup.indexOf(label)).sort((a, b) => a - b),
    )
    expect(markup).toContain(
      'The front mark is a crosshair with a millimeter scale. The back mark is a crosshair with a small square.',
    )
    expect(markup.toLowerCase()).not.toContain('circle')
    expect(markup).toContain(
      'Read two opposite corners. If the readings differ by more than 0.5 mm, enter the average offset.',
    )
  })

  it('hides corner steps until an available scale estimate is OK', () => {
    expect(renderPanel()).not.toContain('Read the corners')
    expect(
      renderPanel({ rulerEstimate: { scale: 0.95, verdict: 'TOO_SMALL' } }),
    ).toContain('Stop here. Fix the print settings and print the sheet again')
    expect(
      renderPanel({ rulerEstimate: { scale: 1, verdict: 'OK' } }),
    ).toContain('Read the corners')
  })

  it('shows corner steps when the current card size has no scale', () => {
    const markup = renderPanel({ hasCalibrationScale: false })

    expect(markup).toContain('This card size has no long scale')
    expect(markup).toContain('Read the corners')
  })

  it.each([
    ['TWO_SIDES_HAND', '0.8', '0', 'skip'],
    ['TWO_SIDES_HAND', '1.1', '0', 'apply'],
    ['TWO_SIDES_MACHINE', '0.2', '0', 'skip'],
    ['TWO_SIDES_MACHINE', '0.4', '0', 'apply'],
  ] as const)(
    'shows %s advice for readings %s and %s',
    (printMode, observedXmm, observedYmm, result) => {
      const markup = renderPanel({
        printMode,
        rulerEstimate: { scale: 1, verdict: 'OK' },
        observedXmm,
        observedYmm,
      })

      expect(markup).toContain(
        result === 'skip'
          ? 'Your printer is accurate enough. You do not need to apply a correction.'
          : 'Apply this correction, then print the sheet again to check it.',
      )
      expect(markup).toContain(
        result === 'skip' ? 'btn-outline btn-secondary' : 'btn-primary',
      )
    },
  )
})
