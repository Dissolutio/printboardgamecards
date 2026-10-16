import { describe, expect, it } from 'vitest'
import {
  addCard,
  deleteCard,
  duplicateCard,
  quantityLabel,
  stepQuantity,
  totalCopies,
} from './deck.ts'
import type { Card } from '../types.ts'

function createCard(id: string, quantity: number): Card {
  return {
    id,
    bleedMode: 'IMAGE',
    frontBackground: { enabled: true, color: '#f5efe6' },
    backBackground: { enabled: true, color: '#e0f0ff' },
    bleedColor: '#ffffff',
    quantity,
  }
}

describe('deck helpers', () => {
  it('adds a card without changing the original deck', () => {
    const first = createCard('first', 1)
    const second = createCard('second', 2)

    expect(addCard([first], second)).toEqual([first, second])
    expect(first.id).toBe('first')
  })

  it('duplicates a card and assigns the new id', () => {
    const source = { ...createCard('source', 2), frontSrc: 'blob:front' }

    expect(duplicateCard([source], 'source', 'copy')).toEqual([
      source,
      { ...source, id: 'copy' },
    ])
  })

  it('deletes only the requested card', () => {
    const deck = [createCard('first', 1), createCard('second', 2)]

    expect(deleteCard(deck, 'first')).toEqual([deck[1]])
  })

  it('totals copies across all cards', () => {
    expect(totalCopies([createCard('first', 3), createCard('second', 2)])).toBe(5)
  })

  it('steps copy counts without going below one', () => {
    expect(stepQuantity(1, -1)).toBe(1)
    expect(stepQuantity(1, 1)).toBe(2)
    expect(stepQuantity(2, -1)).toBe(1)
  })

  it('labels singular and plural copy counts correctly', () => {
    expect(quantityLabel(1)).toBe('1 copy')
    expect(quantityLabel(2)).toBe('2 copies')
  })
})
