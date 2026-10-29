import { describe, expect, it } from 'vitest'
import { effectiveDpi } from './crop.ts'
import { effectiveDpiForSource, isSvgFile, isSvgUrl } from './vectorSource.ts'

describe('isSvgFile', () => {
  it('recognizes the SVG MIME type and an extension when the type is empty', () => {
    expect(isSvgFile({ type: 'image/svg+xml', name: 'art.bin' })).toBe(true)
    expect(isSvgFile({ type: '', name: 'art.SVG' })).toBe(true)
    expect(isSvgFile({ type: 'image/png', name: 'art.svg' })).toBe(false)
    expect(isSvgFile({ type: '', name: 'art.png' })).toBe(false)
  })
})

describe('isSvgUrl', () => {
  it('recognizes data, absolute, and relative SVG URLs', () => {
    expect(isSvgUrl('data:image/svg+xml;charset=utf-8,<svg/>')).toBe(true)
    expect(isSvgUrl('https://example.com/card.svg?version=1#front')).toBe(true)
    expect(isSvgUrl('/decks/classic/card.SVG#front')).toBe(true)
    expect(isSvgUrl('../card.svg')).toBe(true)
  })

  it('rejects non-SVG paths and blob URLs', () => {
    expect(isSvgUrl('https://example.com/card.png?file=.svg')).toBe(false)
    expect(isSvgUrl('blob:https://example.com/card.svg')).toBe(false)
    expect(isSvgUrl('data:image/png;base64,abc')).toBe(false)
  })
})

describe('effectiveDpiForSource', () => {
  it('omits DPI for vector sources and reuses effectiveDpi for bitmaps', () => {
    expect(effectiveDpiForSource({
      cropPixelWidth: 750,
      areaWidthPt: 180,
      isVector: true,
    })).toBeUndefined()
    expect(effectiveDpiForSource({
      cropPixelWidth: 750,
      areaWidthPt: 180,
      isVector: false,
    })).toBe(effectiveDpi(750, 180))
  })
})
