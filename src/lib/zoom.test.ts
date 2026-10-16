import { describe, expect, it } from 'vitest'
import {
  clampZoom,
  COARSE_ZOOM_STEP,
  FINE_ZOOM_STEP,
  MAX_ZOOM,
  MIN_ZOOM,
  parseZoomInput,
} from './zoom.ts'

describe('clampZoom', () => {
  it('rounds to hundredths and clamps to the allowed range', () => {
    expect(clampZoom(1.234)).toBe(1.23)
    expect(clampZoom(1.236)).toBe(1.24)
    expect(clampZoom(-2)).toBe(MIN_ZOOM)
    expect(clampZoom(20)).toBe(MAX_ZOOM)
  })

  it('exposes separate coarse and fine step sizes', () => {
    expect(COARSE_ZOOM_STEP).toBe(0.1)
    expect(FINE_ZOOM_STEP).toBe(0.01)
  })

  it('rejects non-finite values and invalid bounds', () => {
    expect(() => clampZoom(Number.NaN)).toThrow(RangeError)
    expect(() => clampZoom(1, 2, 1)).toThrow(RangeError)
  })
})

describe('parseZoomInput', () => {
  it('parses and clamps valid input to a hundredth', () => {
    expect(parseZoomInput('1.37')).toBe(1.37)
    expect(parseZoomInput('1.7')).toBe(1.7)
    expect(parseZoomInput('20')).toBe(MAX_ZOOM)
    expect(parseZoomInput('0')).toBe(MIN_ZOOM)
  })

  it('ignores blank and non-numeric input', () => {
    expect(parseZoomInput('')).toBeUndefined()
    expect(parseZoomInput('  ')).toBeUndefined()
    expect(parseZoomInput('not a number')).toBeUndefined()
  })
})
