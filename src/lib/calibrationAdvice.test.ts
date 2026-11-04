import { describe, expect, it } from 'vitest'
import {
  calibrationAdvice,
  HAND_CUT_SKIP_LIMIT_MM,
  MACHINE_CUT_SKIP_LIMIT_MM,
} from './calibrationAdvice.ts'

describe('calibrationAdvice', () => {
  it('exports the hand and machine cutting limits', () => {
    expect(HAND_CUT_SKIP_LIMIT_MM).toBe(1.0)
    expect(MACHINE_CUT_SKIP_LIMIT_MM).toBe(0.3)
  })

  it.each([
    ['TWO_SIDES_HAND', 1.0, 'SKIP'],
    ['TWO_SIDES_HAND', 1.01, 'APPLY'],
    ['TWO_SIDES_MACHINE', 0.3, 'SKIP'],
    ['TWO_SIDES_MACHINE', 0.31, 'APPLY'],
  ] as const)(
    'uses the %s limit for a reading of %s mm',
    (cutting, reading, kind) => {
      expect(
        calibrationAdvice({
          observedXmm: reading,
          observedYmm: 0,
          cutting,
        }),
      ).toEqual({ kind, worstMm: reading })
    },
  )

  it('uses the absolute value of negative readings', () => {
    expect(
      calibrationAdvice({
        observedXmm: '-0.8',
        observedYmm: '0.2',
        cutting: 'TWO_SIDES_HAND',
      }),
    ).toEqual({ kind: 'SKIP', worstMm: 0.8 })
  })

  it.each([
    [NaN, 0],
    ['', 0],
    [0, undefined],
  ])('returns no advice for incomplete or invalid readings', (x, y) => {
    expect(
      calibrationAdvice({
        observedXmm: x,
        observedYmm: y,
        cutting: 'TWO_SIDES_HAND',
      }),
    ).toBeUndefined()
  })
})
