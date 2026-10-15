import { Document, Page, View } from '@react-pdf/renderer'
import type { Size } from '../lib/geometry.ts'
import { layoutPages, type Grid } from '../lib/layout.ts'
import PrintPage from './PrintPage.tsx'
import type { Card } from '../types.ts'

type SingleSidedDocProps = {
  cards: Card[]
  paper: Size
  grid: Grid
  cardSize: Size
}

export default function SingleSidedDoc({
  cards,
  paper,
  grid,
  cardSize,
}: SingleSidedDocProps) {
  const pages = layoutPages(cards, grid)

  return (
    <Document>
      {pages.map((page, pageIndex) => (
        <Page
          key={`page-${pageIndex}`}
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
              placements={page.placements}
              cards={cards}
              cardSize={cardSize}
              side="front"
              drawCropMarks
            />
          </View>
        </Page>
      ))}
    </Document>
  )
}
