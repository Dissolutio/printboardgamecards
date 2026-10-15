import { Document, Page, View } from '@react-pdf/renderer'
import type { Size } from '../lib/geometry.ts'
import { layoutPrintAndGlue, type TightGrid } from '../lib/layout.ts'
import type { Card } from '../types.ts'
import CardPiece from './CardPiece.tsx'
import CropMarks from './CropMarks.tsx'

type PrintAndGlueDocProps = {
  cards: Card[]
  paper: Size
  grid: TightGrid
  cardSize: Size
}

export default function PrintAndGlueDoc({
  cards,
  paper,
  grid,
  cardSize,
}: PrintAndGlueDocProps) {
  const pages = layoutPrintAndGlue(cards, grid)
  const cardsById = new Map(cards.map((card) => [card.id, card]))

  return (
    <Document>
      {pages.map((page, pageIndex) => (
        <Page key={`page-${pageIndex}`} size={[paper.width, paper.height]}>
          <View
            style={{
              position: 'relative',
              width: paper.width,
              height: paper.height,
            }}
          >
            {page.placements.map((placement, index) => {
              const card = cardsById.get(placement.cardId)
              if (!card) return null

              return (
                <CardPiece
                  key={`piece-${index}`}
                  card={card}
                  placement={placement}
                  cardSize={cardSize}
                  side={placement.side}
                  paintedBleed={placement.paintedBleed}
                  clipToPaintedRect
                />
              )
            })}
            {page.placements.map((placement, index) => (
              <CropMarks
                key={`crop-marks-${index}`}
                placement={placement}
                cardSize={cardSize}
                bleed={placement.paintedBleed}
                offset={1}
                length={4}
              />
            ))}
          </View>
        </Page>
      ))}
    </Document>
  )
}
