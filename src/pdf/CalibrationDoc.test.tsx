import { Polygon, renderToBuffer, Svg, Text } from '@react-pdf/renderer'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
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

function elementsIn(node: ReactNode): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap(elementsIn)
  if (!isValidElement(node)) return []

  const element = node as ReactElement<{ children?: ReactNode }>
  return [element, ...elementsIn(element.props.children)]
}

describe('CalibrationDoc', () => {
  it('renders a vector arrow beside both page labels', () => {
    const paper = PAPER.LETTER
    const cardSize = CARD_PRESETS.POKER
    const tree = CalibrationDoc({
      paper,
      cardSize,
      grid: calculateGrid({ paper, card: cardSize }),
      calibration: { offsetX: 0, offsetY: 0 },
    })
    const elements = elementsIn(tree)
    const labels = elements
      .filter((element) => element.type === Text)
      .map((element) => (element.props as { children?: ReactNode }).children)

    expect(labels).toContain('FRONT')
    expect(labels).toContain('BACK')
    expect(elements.filter((element) => element.type === Svg)).toHaveLength(2)
    expect(elements.filter((element) => element.type === Polygon)).toHaveLength(2)
  })

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

  for (const { paper } of paperCases) {
    it(`renders front and calibrated back pages on ${paper.width}×${paper.height} pt`, async () => {
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
  }
})
