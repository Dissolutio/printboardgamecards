import type { BleedMode, Card } from '../types.ts'

export type PieceFill = {
  rect: 'painted' | 'trim'
  color: string
}

type PieceStyle = Pick<Card, 'backgroundColor' | 'bleedColor'> & {
  bleedMode: BleedMode
}

export function pieceFills(card: PieceStyle): PieceFill[] {
  if (card.bleedMode === 'IMAGE') {
    return [{ rect: 'painted', color: card.backgroundColor }]
  }

  return [
    { rect: 'painted', color: card.bleedColor },
    { rect: 'trim', color: card.backgroundColor },
  ]
}
