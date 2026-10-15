import { Document, Page, View } from '@react-pdf/renderer'
import type { Size } from '../lib/geometry.ts'
import {
  layoutDuplexPages,
  type Calibration,
  type Grid,
} from '../lib/layout.ts'
import type { BleedMode, Card } from '../types.ts'
import PrintPage from './PrintPage.tsx'

type DuplexDocProps = {
  cards: Card[]
  paper: Size
  grid: Grid
  cardSize: Size
  bleedMode: BleedMode
  calibration: Calibration
}

export default function DuplexDoc({
  cards,
  paper,
  grid,
  cardSize,
  bleedMode,
  calibration,
}: DuplexDocProps) {
  const pagePairs = layoutDuplexPages(cards, grid, calibration)

  return (
    <Document>
      {pagePairs.flatMap((pair, pairIndex) => [
        <Page
          key={`front-${pairIndex}`}
          size={[paper.width, paper.height]}
        >
          <View
            style={{
              position: 'relative',
              width: paper.width,
              height: paper.height,
            }}
          >
            <PrintPage
              placements={pair.front}
              cards={cards}
              cardSize={cardSize}
              bleedMode={bleedMode}
              side="front"
              drawCropMarks
            />
          </View>
        </Page>,
        <Page
          key={`back-${pairIndex}`}
          size={[paper.width, paper.height]}
        >
          <View
            style={{
              position: 'relative',
              width: paper.width,
              height: paper.height,
            }}
          >
            <PrintPage
              placements={pair.back}
              cards={cards}
              cardSize={cardSize}
              bleedMode={bleedMode}
              side="back"
              drawCropMarks={false}
            />
          </View>
        </Page>,
      ])}
    </Document>
  )
}
