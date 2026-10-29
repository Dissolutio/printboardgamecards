import { DOMParser } from '@xmldom/xmldom'
import { describe, expect, it } from 'vitest'
import {
  BACK_DESIGNS,
  BACK_PALETTES,
  backSvgToDataUrl,
  generateBackSvg,
} from './backDesigns.ts'

const sizes = [
  { name: 'Poker', width: 700, height: 980 },
  { name: 'Bridge', width: 630, height: 980 },
  { name: 'Tarot', width: 700, height: 1200 },
] as const

function parseSvg(svg: string) {
  const errors: string[] = []
  const document = new DOMParser({
    onError: (level, message) => errors.push(`${level}: ${message}`),
  }).parseFromString(svg, 'image/svg+xml')

  expect(errors).toEqual([])
  const root = document.documentElement
  if (!root) {
    throw new Error('SVG has no document element.')
  }
  return root
}

describe('generateBackSvg', () => {
  it.each(BACK_DESIGNS.flatMap((design) =>
    BACK_PALETTES.flatMap((palette) =>
      sizes.map((size) => ({ design, palette, size })),
    ),
  ))(
    'generates valid $design.id artwork for $palette.id at $size.name size',
    ({ design, palette, size }) => {
      const svg = generateBackSvg({
        design: design.id,
        width: size.width,
        height: size.height,
        primary: palette.primary,
        secondary: palette.secondary,
      })
      const root = parseSvg(svg)
      const firstNode = root.firstChild
      const firstElement = root.getElementsByTagName('rect').item(0)
      if (!firstElement) {
        throw new Error('SVG has no background rectangle.')
      }

      expect(root.tagName).toBe('svg')
      expect(root.getAttribute('width')).toBe(String(size.width))
      expect(root.getAttribute('height')).toBe(String(size.height))
      expect(root.getAttribute('viewBox')).toBe(`0 0 ${size.width} ${size.height}`)
      expect(firstNode?.nodeName).toBe('rect')
      expect(firstElement).toBe(firstNode)
      expect(firstElement.getAttribute('width')).toBe(String(size.width))
      expect(firstElement.getAttribute('height')).toBe(String(size.height))
      expect(firstElement.getAttribute('fill')).toBe(palette.primary)
      expect(svg).not.toMatch(
        /<(?:text|tspan|filter|image|style|script|pattern|use|linearGradient)\b|class=|style=|NaN|undefined|Infinity|xlink:href/i,
      )
      expect(svg.length).toBeLessThan(40_000)
    },
  )

  it('is deterministic', () => {
    const options = {
      design: 'CROSSHATCH' as const,
      width: 700,
      height: 980,
      primary: '#abc',
      secondary: '#123456',
    }

    expect(generateBackSvg(options)).toBe(generateBackSvg(options))
  })

  it.each(['red', '#12', '#ggg', '#fff"/&gt;'])('rejects unsafe primary color %s', (primary) => {
    expect(() =>
      generateBackSvg({
        design: 'SOLID',
        width: 700,
        height: 980,
        primary,
        secondary: '#000',
      }),
    ).toThrow(RangeError)
  })

  it('rejects unsafe secondary colors', () => {
    expect(() =>
      generateBackSvg({
        design: 'SOLID',
        width: 700,
        height: 980,
        primary: '#fff',
        secondary: '#fff"/&gt;',
      }),
    ).toThrow(RangeError)
  })

  it('normalizes short and uppercase hex colors', () => {
    const svg = generateBackSvg({
      design: 'SOLID',
      width: 700,
      height: 980,
      primary: '#ABC',
      secondary: '#DEADBE',
      border: true,
    })

    expect(svg).toContain('fill="#aabbcc"')
    expect(svg).toContain('stroke="#deadbe"')
  })

  it.each([
    [0, 980],
    [700, 0],
    [Number.POSITIVE_INFINITY, 980],
    [700, Number.NaN],
  ])('rejects invalid dimensions %s x %s', (width, height) => {
    expect(() =>
      generateBackSvg({
        design: 'SOLID',
        width,
        height,
        primary: '#fff',
        secondary: '#000',
      }),
    ).toThrow(RangeError)
  })

  it('adds an optional inset border and URL-encodes SVG data', () => {
    const svg = generateBackSvg({
      design: 'SOLID',
      width: 700,
      height: 980,
      primary: '#fff',
      secondary: '#000',
      border: true,
    })

    expect(svg.match(/<rect\b/g)).toHaveLength(2)
    expect(backSvgToDataUrl(svg)).toBe(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    )
  })
})
