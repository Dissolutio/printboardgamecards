import type { Card } from '../types.ts'

export function addCard(cards: Card[], card: Card): Card[] {
  return [...cards, card]
}

export function duplicateCard(cards: Card[], cardId: string, duplicateId: string): Card[] {
  const index = cards.findIndex((card) => card.id === cardId)
  if (index === -1) throw new RangeError(`Card not found: ${cardId}`)

  return [
    ...cards.slice(0, index + 1),
    { ...cards[index], id: duplicateId },
    ...cards.slice(index + 1),
  ]
}

export function deleteCard(cards: Card[], cardId: string): Card[] {
  return cards.filter((card) => card.id !== cardId)
}

export function totalCopies(cards: Card[]): number {
  return cards.reduce((total, card) => total + card.quantity, 0)
}
