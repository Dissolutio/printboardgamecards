import type { BleedMode, Card, CardBackground, CardSide } from '../types.ts'

export type PieceFill = {
  rect: 'painted' | 'trim'
  color: string
}

type PieceStyle = Pick<
  Card,
  'frontBackground' | 'backBackground' | 'bleedColor'
> & {
  bleedMode: BleedMode
}

type BackgroundFields = Pick<Card, 'frontBackground' | 'backBackground'>

export function hasBackground(card: BackgroundFields, side: CardSide): boolean {
  return (side === 'front' ? card.frontBackground : card.backBackground).enabled
}

export function withBackgroundEnabled(
  background: CardBackground,
  enabled: boolean,
): CardBackground {
  return { ...background, enabled }
}

export function backgroundFor(
  card: BackgroundFields,
  side: CardSide,
): string {
  const background = side === 'front' ? card.frontBackground : card.backBackground
  return background.enabled ? background.color : '#ffffff'
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
