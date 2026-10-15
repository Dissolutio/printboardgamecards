import { Document, Image, Page, View } from '@react-pdf/renderer'
import { DEFAULT_BLEED, type Size } from '../lib/geometry.ts'
import { layoutPages, type Grid, type Placement } from '../lib/layout.ts'
import type { Card } from '../types.ts'

type SingleSidedDocProps = {
  cards: Card[]
  paper: Size
  grid: Grid
}

type CropMark = {
  left: number
  top: number
  width: number
  height: number
}

function cropMarks(placement: Placement, card: Card): CropMark[] {
  const trimLeft = placement.x + DEFAULT_BLEED
  const trimTop = placement.y + DEFAULT_BLEED
  const trimRight = trimLeft + card.width
  const trimBottom = trimTop + card.height
  const gap = 1
  const length = 6
  const thickness = 0.5

  return [
    { left: trimLeft - gap - length, top: trimTop - gap - thickness / 2, width: length, height: thickness },
    { left: trimLeft - gap - thickness / 2, top: trimTop - gap - length, width: thickness, height: length },
    { left: trimRight + gap, top: trimTop - gap - thickness / 2, width: length, height: thickness },
    { left: trimRight + gap + thickness / 2, top: trimTop - gap - length, width: thickness, height: length },
    { left: trimLeft - gap - length, top: trimBottom + gap, width: length, height: thickness },
    { left: trimLeft - gap - thickness / 2, top: trimBottom + gap, width: thickness, height: length },
    { left: trimRight + gap, top: trimBottom + gap, width: length, height: thickness },
    { left: trimRight + gap + thickness / 2, top: trimBottom + gap, width: thickness, height: length },
  ]
}

export default function SingleSidedDoc({ cards, paper, grid }: SingleSidedDocProps) {
  const pages = layoutPages(cards, grid)
  const cardsById = new Map(cards.map((card) => [card.id, card]))

  return (
    <Document>
      {pages.map((page, pageIndex) => (
        <Page
          key={`page-${pageIndex}`}
          size={[paper.width, paper.height]}
          style={{ margin: 0 }}
          wrap={false}
        >
          {page.placements.flatMap((placement, placementIndex) => {
            const card = cardsById.get(placement.cardId)
            if (!card?.frontSrc) return []

            const imageLeft =
              card.bleedMode === 'IMAGE' ? placement.x : placement.x + DEFAULT_BLEED
            const imageTop =
              card.bleedMode === 'IMAGE' ? placement.y : placement.y + DEFAULT_BLEED
            const imageWidth = card.bleedMode === 'IMAGE' ? placement.width : card.width
            const imageHeight = card.bleedMode === 'IMAGE' ? placement.height : card.height

            return (
              [
                ...(card.bleedMode === 'COLOR'
                  ? [
                      <View
                        key={`bleed-${placementIndex}`}
                        style={{
                          position: 'absolute',
                          left: placement.x,
                          top: placement.y,
                          width: placement.width,
                          height: placement.height,
                          backgroundColor: card.bleedColor,
                        }}
                      />,
                    ]
                  : []),
                <Image
                  key={`image-${placementIndex}`}
                  src={card.frontSrc}
                  style={{
                    position: 'absolute',
                    left: imageLeft,
                    top: imageTop,
                    width: imageWidth,
                    height: imageHeight,
                  }}
                />,
              ]
            )
          })}
          {page.placements.flatMap((placement, placementIndex) => {
            const card = cardsById.get(placement.cardId)
            if (!card) return []

            return cropMarks(placement, card).map((mark, markIndex) => (
              <View
                key={`mark-${placementIndex}-${markIndex}`}
                style={{
                  position: 'absolute',
                  left: mark.left,
                  top: mark.top,
                  width: mark.width,
                  height: mark.height,
                  backgroundColor: '#000000',
                }}
              />
            ))
          })}
        </Page>
      ))}
    </Document>
  )
}
