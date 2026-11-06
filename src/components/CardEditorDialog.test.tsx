import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import CardEditorDialog, { BackUsePanel } from './CardEditorDialog.tsx'
import type { useCards } from '../hooks/useCards.ts'
import type { Card } from '../types.ts'

function makeCard(id: string, backSrc = 'back.png'): Card {
  return {
    id,
    bleedMode: 'IMAGE',
    frontSrc: `front-${id}.png`,
    frontCrop: { x: 0, y: 0, width: 100, height: 140 },
    frontProcessedSrc: `front-processed-${id}.png`,
    backSrc,
    backCrop: { x: 0, y: 0, width: 100, height: 140 },
    backProcessedSrc: `back-processed-${id}.png`,
    frontBackground: { enabled: false, color: '#ffffff' },
    backBackground: { enabled: false, color: '#ffffff' },
    bleedColor: '#ffffff',
    quantity: 1,
  }
}

function renderDialog(cards: Card[], selectedId: string, open = true) {
  const cardState = {
    cards,
    selectedId,
    errors: { front: undefined, back: undefined },
    handleQuantityStep: () => {},
    updateCard: () => {},
    handleImageSelect: () => {},
    handleImageRemove: () => {},
    handleCropChange: () => {},
    handleProcessedImage: () => {},
    handleError: () => {},
    handleDuplicateCard: () => {},
    handleUseBackForEveryCard: () => {},
  } as unknown as ReturnType<typeof useCards>

  return renderToStaticMarkup(
    <CardEditorDialog
      open={open}
      onClose={() => {}}
      cardState={cardState}
      cardSize={{ width: 180, height: 252 }}
      disabled={false}
      onSelect={() => {}}
      onBleedModeChange={() => {}}
      onDelete={() => {}}
    />,
  )
}

describe('CardEditorDialog', () => {
  it('shows the selected card position and resets to the Front tab', () => {
    const cards = Array.from({ length: 5 }, (_, index) =>
      makeCard(`card-${index + 1}`),
    )
    const before = structuredClone(cards)
    const markup = renderDialog(cards, 'card-2')

    expect(markup).toContain('Card 2 of 5')
    expect(markup).toContain('aria-label="Previous card"')
    expect(markup).toContain('role="tablist"')
    expect(markup).toContain('role="tab"')
    expect(markup).toContain('aria-selected="true"')
    expect(markup).toContain('aria-selected="false"')
    expect(markup).toContain('>Front</button>')
    expect(markup).toContain('>Back</button>')
    expect(markup).not.toContain('This back is used on')
    expect(cards).toEqual(before)
  })

  it('updates the displayed position when a neighboring card is selected', () => {
    const cards = Array.from({ length: 5 }, (_, index) =>
      makeCard(`card-${index + 1}`),
    )

    expect(renderDialog(cards, 'card-3')).toContain('Card 3 of 5')
    expect(renderDialog(cards, 'card-4')).toContain('Card 4 of 5')
    expect(renderDialog(cards, 'card-3')).toContain('Card 3 of 5')
  })

  it('disables previous and next at the ends of the deck', () => {
    const cards = [makeCard('card-1'), makeCard('card-2')]
    const first = renderDialog(cards, 'card-1')
    const last = renderDialog(cards, 'card-2')

    expect(first).toMatch(/aria-label="Previous card" disabled=""/)
    expect(first).not.toMatch(/aria-label="Next card" disabled=""/)
    expect(last).not.toMatch(/aria-label="Previous card" disabled=""/)
    expect(last).toMatch(/aria-label="Next card" disabled=""/)
  })

  it('does not render a closed editor', () => {
    expect(renderDialog([makeCard('card-1')], 'card-1', false)).toBe('')
  })

  it('does not change crop or processed image data while rendering cards', () => {
    const cards = [makeCard('card-1'), makeCard('card-2')]
    const cropData = cards.map(({ frontCrop, backCrop, frontProcessedSrc, backProcessedSrc }) => ({
      frontCrop: structuredClone(frontCrop),
      backCrop: structuredClone(backCrop),
      frontProcessedSrc,
      backProcessedSrc,
    }))

    renderDialog(cards, 'card-1')
    renderDialog(cards, 'card-2')
    renderDialog(cards, 'card-1')

    expect(
      cards.map(({ frontCrop, backCrop, frontProcessedSrc, backProcessedSrc }) => ({
        frontCrop,
        backCrop,
        frontProcessedSrc,
        backProcessedSrc,
      })),
    ).toEqual(cropData)
  })

  it('renders the dialog navigation, duplicate, delete, and Done actions', () => {
    const markup = renderDialog([makeCard('card-1'), makeCard('card-2')], 'card-1')

    expect(markup).toContain('aria-label="Next card"')
    expect(markup).toContain('>Duplicate card</button>')
    expect(markup).toContain('>Delete card</button>')
    expect(markup).toContain('>Done</button>')
    expect(markup).toContain('aria-label="Close"')
  })
})

describe('BackUsePanel', () => {
  it('shows the count only when more than one card uses the back', () => {
    const card = makeCard('card-1')
    const shared = renderToStaticMarkup(
      <BackUsePanel card={card} count={2} disabled={false} onUse={() => {}} />,
    )
    const single = renderToStaticMarkup(
      <BackUsePanel card={card} count={1} disabled={false} onUse={() => {}} />,
    )

    expect(shared).toContain('This back is used on 2 cards.')
    expect(single).not.toContain('This back is used on')
    expect(single).toContain('Other cards keep their own fronts.')
    expect(shared).toContain('>Use this back for every card</button>')
    expect(shared).not.toContain('disabled="">Use this back for every card</button>')
  })
})
