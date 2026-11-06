import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import CardList from './CardList.tsx'
import type { Card } from '../types.ts'

const cards: Card[] = [
  {
    id: 'card-1',
    bleedMode: 'IMAGE',
    frontBackground: { enabled: false, color: '#ffffff' },
    backBackground: { enabled: false, color: '#ffffff' },
    bleedColor: '#ffffff',
    quantity: 1,
  },
]

describe('CardList', () => {
  it('renders selectable cards and keeps duplicate and delete actions available', () => {
    const markup = renderToStaticMarkup(
      <CardList
        cards={cards}
        selectedId="card-1"
        cardSize={{ width: 180, height: 252 }}
        disabled={false}
        onAdd={() => {}}
        onSelect={() => {}}
        onQuantityStep={() => {}}
        onDuplicate={() => {}}
        onDelete={() => {}}
        onChangeEveryBack={() => {}}
      />,
    )

    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain('>Card 1</span>')
    expect(markup).toContain('>Duplicate</button>')
    expect(markup).toContain('>Delete</button>')
  })
})
