import { describe, expect, it } from 'vitest'
import { pieceFills } from './piece.ts'

describe('pieceFills', () => {
  it('uses the card background for the painted area in image bleed mode', () => {
    const card = {
      bleedMode: 'IMAGE' as const,
      frontBackgroundColor: '#f0e0d0',
      backBackgroundColor: '#d0e0f0',
      bleedColor: '#102030',
    }

    expect(
      pieceFills(card, 'front'),
    ).toEqual([{ rect: 'painted', color: '#f0e0d0' }])
    expect(pieceFills(card, 'back')).toEqual([{ rect: 'painted', color: '#d0e0f0' }])
  })

  it('uses each side background inside the trim in solid color mode', () => {
    const card = {
      bleedMode: 'COLOR' as const,
      frontBackgroundColor: '#f0e0d0',
      backBackgroundColor: '#d0e0f0',
      bleedColor: '#102030',
    }
    const painted = { rect: 'painted', color: '#102030' }

    expect(
      pieceFills(card, 'front'),
    ).toEqual([
      painted,
      { rect: 'trim', color: '#f0e0d0' },
    ])
    expect(pieceFills(card, 'back')).toEqual([
      painted,
      { rect: 'trim', color: '#d0e0f0' },
    ])
  })

  it('defaults unset side backgrounds to white in both modes', () => {
    const card = { bleedColor: '#102030' }

    for (const bleedMode of ['IMAGE', 'COLOR'] as const) {
      expect(
        pieceFills({ ...card, bleedMode }, 'front').at(-1)?.color,
      ).toBe('#ffffff')
      expect(
        pieceFills({ ...card, bleedMode }, 'back').at(-1)?.color,
      ).toBe('#ffffff')
    }
  })
})
