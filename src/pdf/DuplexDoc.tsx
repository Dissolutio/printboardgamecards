import { Document, Page } from '@react-pdf/renderer'
import type { Size } from '../lib/geometry.ts'
import {
  layoutDuplexPages,
  type Calibration,
  type Grid,
} from '../lib/layout.ts'
import type { Card } from '../types.ts'
import PrintPage from './PrintPage.tsx'

type DuplexDocProps = {
  cards: Card[]
  paper: Size
  grid: Grid
  calibration: Calibration
}

export default function DuplexDoc({
  cards,
  paper,
  grid,
  calibration,
}: DuplexDocProps) {
  const pagePairs = layoutDuplexPages(cards, grid, calibration)

  return (
    <Document>
      {pagePairs.flatMap((pair, pairIndex) => [
        <Page
          key={`front-${pairIndex}`}
          size={[paper.width, paper.height]}
          style={{ margin: 0 }}
          wrap={false}
        >
          <PrintPage
            placements={pair.front}
            cards={cards}
            side="front"
            drawCropMarks
          />
        </Page>,
        <Page
          key={`back-${pairIndex}`}
          size={[paper.width, paper.height]}
          style={{ margin: 0 }}
          wrap={false}
        >
          <PrintPage
            placements={pair.back}
            cards={cards}
            side="back"
            drawCropMarks={false}
          />
        </Page>,
      ])}
    </Document>
  )
}
