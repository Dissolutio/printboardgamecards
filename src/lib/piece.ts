import type { BleedMode, Card, CardSide } from '../types.ts'

export type PieceFill = {
  rect: 'painted' | 'trim'
  color: string
}

type PieceStyle = Pick<
  Card,
  'frontBackgroundColor' | 'backBackgroundColor' | 'bleedColor'
> & {
  bleedMode: BleedMode
}

export function backgroundFor(
  card: Pick<Card, 'frontBackgroundColor' | 'backBackgroundColor'>,
  side: CardSide,
): string {
  const color = side === 'front' ? card.frontBackgroundColor : card.backBackgroundColor
  return color ?? '#ffffff'
}

export function pieceFills(card: PieceStyle, side: CardSide): PieceFill[] {
  const backgroundColor = backgroundFor(card, side)

  if (card.bleedMode === 'IMAGE') {
    return [{ rect: 'painted', color: backgroundColor }]
  }

  return [
    { rect: 'painted', color: card.bleedColor },
    { rect: 'trim', color: backgroundColor },
  ]
}
