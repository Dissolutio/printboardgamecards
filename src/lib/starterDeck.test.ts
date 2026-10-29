import { describe, expect, it } from 'vitest'
import type { DeckManifest, DeckManifestCard } from './deckManifest.ts'
import { buildStarterCards, cardLabel } from './starterDeck.ts'

function createManifest(): DeckManifest {
  const ranks: DeckManifestCard['rank'][] = [
    'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K',
  ]
  const suits: Exclude<DeckManifestCard['suit'], null>[] = ['S', 'H', 'D', 'C']
  const cards: DeckManifestCard[] = ranks.flatMap((rank) => suits.map((suit) => ({
    id: `${rank}${suit}`,
    rank,
    suit,
    file: `${rank}${suit}.svg`,
  })))

  cards.push(
    { id: 'Joker1', rank: 'Joker', suit: null, file: 'Joker1.svg' },
    { id: 'Joker2', rank: 'Joker', suit: null, file: 'Joker2.svg' },
  )

  return {
    id: 'classic',
    name: 'Classic',
    source: 'source',
    commit: 'commit',
    license: 'license',
    viewBox: { width: 1, height: 1 },
    cards,
  }
}

function createIds(): () => string {
  let nextId = 0
  return () => `card-${nextId++}`
}

describe('buildStarterCards', () => {
  it('builds all cards in manifest order with the requested defaults', () => {
    const manifest = createManifest()
    const original = JSON.stringify(manifest)
    const cards = buildStarterCards({
      manifest,
      baseUrl: '/decks/classic',
      includeJokers: true,
      makeId: createIds(),
    })

    expect(cards).toHaveLength(54)
    expect(cards.map((card) => card.frontSrc)).toEqual(
      manifest.cards.map((card) => `/decks/classic/${card.file}`),
    )
    expect(new Set(cards.map((card) => card.id)).size).toBe(54)
    expect(cards[0]).toEqual({
      id: 'card-0',
      frontSrc: '/decks/classic/AS.svg',
      quantity: 1,
      bleedMode: 'COLOR',
      bleedColor: '#ffffff',
      frontBackground: { enabled: false, color: '#ffffff' },
      backBackground: { enabled: false, color: '#ffffff' },
    })
    expect(JSON.stringify(manifest)).toBe(original)
  })

  it('omits Jokers when requested', () => {
    const cards = buildStarterCards({
      manifest: createManifest(),
      baseUrl: '/decks/classic/',
      includeJokers: false,
      makeId: createIds(),
    })

    expect(cards).toHaveLength(52)
    expect(cards.every((card) => !card.frontSrc?.includes('Joker'))).toBe(true)
  })

  it('normalizes a trailing slash and applies backSrc to every card only when provided', () => {
    const manifest = createManifest()
    const withoutSlash = buildStarterCards({
      manifest,
      baseUrl: '/decks/classic',
      includeJokers: true,
      makeId: createIds(),
    })
    const withSlash = buildStarterCards({
      manifest,
      baseUrl: '/decks/classic/',
      includeJokers: true,
      makeId: createIds(),
      backSrc: '/backs/card-back.svg',
    })

    expect(withSlash.map((card) => card.frontSrc)).toEqual(
      withoutSlash.map((card) => card.frontSrc),
    )
    expect(withSlash.every((card) => card.backSrc === '/backs/card-back.svg')).toBe(true)
    expect(withoutSlash.every((card) => card.backSrc === undefined)).toBe(true)
  })

  it('rejects duplicate ids from makeId', () => {
    expect(() => buildStarterCards({
      manifest: createManifest(),
      baseUrl: '/cards',
      includeJokers: true,
      makeId: () => 'same-id',
    })).toThrow('makeId must return a unique non-empty id')
  })
})

describe('cardLabel', () => {
  it.each([
    [{ id: 'AS', rank: 'A', suit: 'S', file: 'AS.svg' }, 'Ace of Spades'],
    [{ id: '10H', rank: '10', suit: 'H', file: '10H.svg' }, '10 of Hearts'],
    [{ id: 'KD', rank: 'K', suit: 'D', file: 'KD.svg' }, 'King of Diamonds'],
    [{ id: 'Joker1', rank: 'Joker', suit: null, file: 'Joker1.svg' }, 'Joker 1'],
    [{ id: 'Joker2', rank: 'Joker', suit: null, file: 'Joker2.svg' }, 'Joker 2'],
  ] satisfies Array<[DeckManifestCard, string]>)('labels %s', (card, label) => {
    expect(cardLabel(card)).toBe(label)
  })
})
