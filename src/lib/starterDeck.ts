import type { Card } from '../types.ts'
import type { DeckManifest, DeckManifestCard } from './deckManifest.ts'

type BuildStarterCardsOptions = {
  manifest: DeckManifest
  baseUrl: string
  includeJokers: boolean
  makeId: () => string
  backSrc?: string
}

export function buildStarterCards({
  manifest,
  baseUrl,
  includeJokers,
  makeId,
  backSrc,
}: BuildStarterCardsOptions): Card[] {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')
  const cardIds = new Set<string>()

  return manifest.cards
    .filter((card) => includeJokers || card.rank !== 'Joker')
    .map((card) => {
      const id = makeId()
      if (id.trim().length === 0 || cardIds.has(id)) {
        throw new Error('makeId must return a unique non-empty id for every card.')
      }
      cardIds.add(id)

      return {
        id,
        frontSrc: `${normalizedBaseUrl}/${card.file}`,
        ...(backSrc === undefined ? {} : { backSrc }),
        quantity: 1,
        bleedMode: 'COLOR',
        bleedColor: '#ffffff',
        frontBackground: { enabled: false, color: '#ffffff' },
        backBackground: { enabled: false, color: '#ffffff' },
      }
    })
}

const rankLabels: Record<DeckManifestCard['rank'], string> = {
  A: 'Ace',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  J: 'Jack',
  Q: 'Queen',
  K: 'King',
  Joker: 'Joker',
}

const suitLabels: Record<Exclude<DeckManifestCard['suit'], null>, string> = {
  S: 'Spades',
  H: 'Hearts',
  D: 'Diamonds',
  C: 'Clubs',
}

export function cardLabel(card: DeckManifestCard): string {
  if (card.rank === 'Joker') {
    const number = card.id.match(/\d+$/)?.[0]
    return number ? `Joker ${number}` : 'Joker'
  }

  const suit = card.suit === null ? 'Unknown suit' : suitLabels[card.suit]
  return `${rankLabels[card.rank]} of ${suit}`
}
