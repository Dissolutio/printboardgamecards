import { createRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CARD_PRESETS } from '../lib/geometry.ts'
import StartScreen from './StartScreen.tsx'

describe('StartScreen PDF tile', () => {
  it('shows the PDF adjustment action and description', () => {
    const markup = renderToStaticMarkup(
      <StartScreen
        cardSize={CARD_PRESETS.POKER}
        presetName="POKER"
        paperName="LETTER"
        exportMode="DUPLEX"
        pieceOrientation="AUTO"
        disabled={false}
        isLoadingManifest={false}
        isProcessing={false}
        onCreate={async () => false}
        onOpenProject={() => {}}
        projectFileInput={createRef<HTMLInputElement>()}
        onStartWithOneCard={() => {}}
        onAdjustPdf={() => {}}
      />,
    )

    expect(markup).toContain('Have your own PDF?')
    expect(markup).toContain(
      'Calibrate your printer, then upload your two-sided PDF. We shift the back pages to match your printer.',
    )
    expect(markup).toContain('Adjust my PDF')
  })
})
