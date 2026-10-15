import { describe, expect, it } from 'vitest'
import { pieceFills } from './piece.ts'

describe('pieceFills', () => {
  it('uses the card background for the painted area in image bleed mode', () => {
    expect(
      pieceFills({
        bleedMode: 'IMAGE',
        backgroundColor: '#f0e0d0',
        bleedColor: '#102030',
      }),
    ).toEqual([{ rect: 'painted', color: '#f0e0d0' }])
  })

  it('uses the bleed color outside the trim and the card background inside it', () => {
    expect(
      pieceFills({
        bleedMode: 'COLOR',
        backgroundColor: '#f0e0d0',
        bleedColor: '#102030',
      }),
    ).toEqual([
      { rect: 'painted', color: '#102030' },
      { rect: 'trim', color: '#f0e0d0' },
    ])
  })
})
