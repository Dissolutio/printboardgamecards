import type { Card, PixelCropRect } from '../types.ts'
import { hasBackground } from './piece.ts'

export type BackSyncPlan = {
  cardsToUpdate: Card[]
  needsConfirmation: boolean
}

function cropsDiffer(
  left: PixelCropRect | undefined,
  right: PixelCropRect | undefined,
): boolean {
  if (!left || !right) return left !== right
  return (
    left.x !== right.x ||
    left.y !== right.y ||
    left.width !== right.width ||
    left.height !== right.height
  )
}

export function planBackSync(selectedCard: Card, cards: Card[]): BackSyncPlan {
  const cardsToUpdate = cards.filter((card) => card.id !== selectedCard.id)
  return {
    cardsToUpdate,
    needsConfirmation: cardsToUpdate.some(
      (card) =>
        card.backSrc !== selectedCard.backSrc ||
        cropsDiffer(card.backCrop, selectedCard.backCrop) ||
        hasBackground(card, 'back'),
    ),
  }
}
