import { describe, expect, it } from 'vitest'
import type { Card } from '../types.ts'
import { findDisallowedSources } from './sourcePolicy.ts'

function createCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    bleedMode: 'IMAGE',
    frontBackground: { enabled: false, color: '#ffffff' },
    backBackground: { enabled: false, color: '#ffffff' },
    bleedColor: '#ffffff',
    quantity: 1,
    ...overrides,
  }
}

describe('findDisallowedSources', () => {
  it('allows supported image data URLs and static app paths', () => {
    expect(findDisallowedSources([
      createCard({
        frontSrc: 'data:image/png;base64,abc',
        backSrc: 'data:image/svg+xml;charset=utf-8,%3Csvg/%3E',
      }),
      createCard({
        id: 'card-3',
        frontSrc: 'data:image/bmp;base64,abc',
        backSrc: 'data:image/avif;base64,abc',
      }),
      createCard({
        id: 'card-2',
        frontSrc: '/app/decks/classic/AS.svg',
        backSrc: '/app/decks/card-back.svg',
      }),
    ], '/app/decks/')).toBeUndefined()
  })

  it.each([
    ['external address', 'https://tracker.example/pixel.png'],
    ['unsupported data source', 'data:text/html;base64,abc'],
    ['blob source', 'blob:https://example.com/image'],
    ['path outside the prefix', '/app/assets/card.svg'],
  ])('rejects a %s and names its card position', (_name, source) => {
    expect(findDisallowedSources([
      createCard({ frontSrc: 'data:image/gif;base64,abc' }),
      createCard({ id: 'card-2', backSrc: source }),
    ], '/app/decks/')).toBe(
      'card 2 back source must be a supported image or app image.',
    )
  })

  it('allows empty sides', () => {
    expect(findDisallowedSources([createCard()], '/decks/')).toBeUndefined()
  })
})
