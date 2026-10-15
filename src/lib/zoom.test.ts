import { describe, expect, it } from 'vitest'
import { clampZoom, MAX_ZOOM, MIN_ZOOM, parseZoomInput } from './zoom.ts'

describe('clampZoom', () => {
  it('rounds to tenths and clamps to the allowed range', () => {
    expect(clampZoom(1.26)).toBe(1.3)
    expect(clampZoom(-2)).toBe(MIN_ZOOM)
    expect(clampZoom(20)).toBe(MAX_ZOOM)
  })

  it('rejects non-finite values and invalid bounds', () => {
    expect(() => clampZoom(Number.NaN)).toThrow(RangeError)
    expect(() => clampZoom(1, 2, 1)).toThrow(RangeError)
  })
})

describe('parseZoomInput', () => {
  it('parses and clamps valid input to a tenth', () => {
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
