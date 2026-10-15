import { describe, expect, it } from 'vitest'
import {
  backgroundFor,
  hasBackground,
  pieceFills,
  withBackgroundEnabled,
} from './piece.ts'

describe('hasBackground', () => {
  it('uses the enabled flag for the explicit per-side background check', () => {
    const card = {
      frontBackground: { enabled: true, color: '#f0e0d0' },
      backBackground: { enabled: false, color: '#d0e0f0' },
    }

    expect(hasBackground(card, 'front')).toBe(true)
    expect(hasBackground(card, 'back')).toBe(false)
  })
})

describe('withBackgroundEnabled', () => {
  it('keeps the stored color when disabling and re-enabling a background', () => {
    const original = { enabled: true, color: '#aabbcc' }
    const disabled = withBackgroundEnabled(original, false)
    const reenabled = withBackgroundEnabled(disabled, true)

    expect(disabled).toEqual({ enabled: false, color: '#aabbcc' })
    expect(reenabled).toEqual({ enabled: true, color: '#aabbcc' })
  })
})

describe('pieceFills', () => {
  it('uses the card background for the painted area in image bleed mode', () => {
    const card = {
      bleedMode: 'IMAGE' as const,
      frontBackground: { enabled: true, color: '#f0e0d0' },
      backBackground: { enabled: true, color: '#d0e0f0' },
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
      frontBackground: { enabled: true, color: '#f0e0d0' },
      backBackground: { enabled: true, color: '#d0e0f0' },
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
    const card = {
      bleedColor: '#102030',
      frontBackground: { enabled: false, color: '#f0e0d0' },
      backBackground: { enabled: false, color: '#d0e0f0' },
    }

    for (const bleedMode of ['IMAGE', 'COLOR'] as const) {
      expect(
        pieceFills({ ...card, bleedMode }, 'front').at(-1)?.color,
      ).toBe('#ffffff')
      expect(
        pieceFills({ ...card, bleedMode }, 'back').at(-1)?.color,
      ).toBe('#ffffff')
    }

    expect(backgroundFor(card, 'front')).toBe('#ffffff')
    expect(backgroundFor(card, 'back')).toBe('#ffffff')
  })
})
