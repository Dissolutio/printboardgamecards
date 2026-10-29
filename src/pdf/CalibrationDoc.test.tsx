import { renderToBuffer } from '@react-pdf/renderer'
import { describe, expect, it } from 'vitest'
import { calculateGrid, CARD_PRESETS, mmToPt, PAPER } from '../lib/geometry.ts'
import CalibrationDoc from './CalibrationDoc.tsx'

const paperCases = [
  { paper: PAPER.LETTER, expectedBox: [0, 0, 612, 792] },
  { paper: PAPER.A4, expectedBox: [0, 0, 595, 842] },
]

function pageMediaBoxes(pdfBytes: Uint8Array): number[][] {
  const pdfText = new TextDecoder('latin1').decode(pdfBytes)
  return [...pdfText.matchAll(/\/Type \/Page\b[\s\S]*?\/MediaBox \[([^\]]+)\]/g)].map(
    ([, values]) => values.trim().split(/\s+/).map(Number),
  )
}

describe('CalibrationDoc', () => {
  for (const { paper, expectedBox } of paperCases) {
    it(`renders two pages at ${paper.width}×${paper.height} pt`, async () => {
      const cardSize = CARD_PRESETS.POKER
      const grid = calculateGrid({ paper, card: cardSize })
      const pdfBytes = await renderToBuffer(
        <CalibrationDoc
          paper={paper}
          cardSize={cardSize}
          grid={grid}
          calibration={{ offsetX: 0, offsetY: 0 }}
        />,
      )

      expect(pageMediaBoxes(pdfBytes)).toEqual([expectedBox, expectedBox])
    })
  }

  it('renders both pages with a non-zero calibration offset', async () => {
    const paper = PAPER.A4
    const cardSize = CARD_PRESETS.POKER
    const grid = calculateGrid({ paper, card: cardSize })
    const pdfBytes = await renderToBuffer(
      <CalibrationDoc
        paper={paper}
        cardSize={cardSize}
        grid={grid}
        calibration={{ offsetX: mmToPt(1), offsetY: mmToPt(-0.5) }}
      />,
    )

    expect(pageMediaBoxes(pdfBytes)).toEqual([
      [0, 0, paper.width, paper.height],
      [0, 0, paper.width, paper.height],
    ])
  })
})
