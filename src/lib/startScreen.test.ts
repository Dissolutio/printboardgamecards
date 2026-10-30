import { describe, expect, it } from 'vitest'
import { chooseScreen, summarizeStartDeck } from './startScreen.ts'
import type { Card } from '../types.ts'

const emptyCard: Card = {
  id: 'empty',
  bleedMode: 'IMAGE',
  frontBackground: { enabled: false, color: '#ffffff' },
  backBackground: { enabled: false, color: '#ffffff' },
  bleedColor: '#ffffff',
  quantity: 1,
}

describe('chooseScreen', () => {
  it('shows the start screen for a deck without images', () => {
    expect(chooseScreen([emptyCard])).toBe('start')
  })

  it('shows the workspace when a card has an image or a project opened', () => {
    expect(chooseScreen([{ ...emptyCard, frontSrc: '/card.png' }])).toBe('workspace')
    expect(chooseScreen([emptyCard], true)).toBe('workspace')
  })
})

describe('summarizeStartDeck', () => {
  it('uses the print and glue layout to report cards, pieces, and pages', () => {
    const summary = summarizeStartDeck({
      cardCount: 52,
      presetName: 'POKER',
      paperName: 'LETTER',
      exportMode: 'PRINT_GLUE',
      pieceOrientation: 'AUTO',
    })

    expect(summary.text).toBe(
      '52 cards. 104 pieces. 13 pages on Letter. 8 pieces per page.',
    )
  })

  it('uses the double-sided layout for the selected paper', () => {
    const summary = summarizeStartDeck({
      cardCount: 52,
      presetName: 'POKER',
      paperName: 'LETTER',
      exportMode: 'DUPLEX',
      pieceOrientation: 'AUTO',
    })

    expect(summary.text).toBe('52 cards. 26 pages on Letter. 4 cards per page.')
  })
})
