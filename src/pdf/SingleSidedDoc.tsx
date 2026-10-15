import { Document, Page } from '@react-pdf/renderer'
import type { Size } from '../lib/geometry.ts'
import { layoutPages, type Grid } from '../lib/layout.ts'
import PrintPage from './PrintPage.tsx'
import type { Card } from '../types.ts'

type SingleSidedDocProps = {
  cards: Card[]
  paper: Size
  grid: Grid
}

export default function SingleSidedDoc({ cards, paper, grid }: SingleSidedDocProps) {
  const pages = layoutPages(cards, grid)

  return (
    <Document>
      {pages.map((page, pageIndex) => (
        <Page
          key={`page-${pageIndex}`}
          size={[paper.width, paper.height]}
          style={{ margin: 0 }}
          wrap={false}
        >
          <PrintPage
            placements={page.placements}
            cards={cards}
            side="front"
            drawCropMarks
          />
        </Page>
      ))}
    </Document>
  )
}
