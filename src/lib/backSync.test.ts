import { describe, expect, it } from 'vitest'
import type { Card } from '../types.ts'
import { planBackSync } from './backSync.ts'

function createCard(id: string, overrides: Partial<Card> = {}): Card {
  return {
    id,
    bleedMode: 'COLOR',
    frontBackground: { enabled: false, color: '#ffffff' },
    backBackground: { enabled: false, color: '#ffffff' },
    bleedColor: '#ffffff',
    quantity: 1,
    ...overrides,
  }
}

describe('planBackSync', () => {
  it('returns every other card without confirmation when its back matches', () => {
    const selected = createCard('selected', { backSrc: 'data:image/png;base64,back' })
    const other = createCard('other', { backSrc: selected.backSrc })

    expect(planBackSync(selected, [selected, other])).toEqual({
      cardsToUpdate: [other],
      needsConfirmation: false,
    })
  })

  it('requests confirmation when another card has a different back image', () => {
    const selected = createCard('selected', { backSrc: 'new-back.png' })
    const other = createCard('other', { backSrc: 'old-back.png' })

    expect(planBackSync(selected, [selected, other]).needsConfirmation).toBe(true)
  })

  it('requests confirmation when another card has a different crop', () => {
    const selected = createCard('selected', {
      backSrc: 'same-back.png',
      backCrop: { x: 0, y: 0, width: 100, height: 100 },
    })
    const other = createCard('other', {
      backSrc: selected.backSrc,
      backCrop: { x: 10, y: 0, width: 100, height: 100 },
    })

    expect(planBackSync(selected, [selected, other]).needsConfirmation).toBe(true)
  })

  it('requests confirmation when another card has a back background', () => {
    const selected = createCard('selected', { backSrc: 'same-back.png' })
    const other = createCard('other', {
      backSrc: selected.backSrc,
      backBackground: { enabled: true, color: '#ff0000' },
    })

    expect(planBackSync(selected, [selected, other]).needsConfirmation).toBe(true)
  })

  it('does not include the selected card in the update plan', () => {
    const selected = createCard('selected')

    expect(planBackSync(selected, [selected])).toEqual({
      cardsToUpdate: [],
      needsConfirmation: false,
    })
  })
})
