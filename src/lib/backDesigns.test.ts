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

type SvgElement = NonNullable<ReturnType<DOMParser['parseFromString']>['documentElement']>

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

function getChildren(root: SvgElement): SvgElement[] {
  const elements: SvgElement[] = []
  for (let node = root.firstChild; node; node = node.nextSibling) {
    if (node.nodeType === 1) elements.push(node as SvgElement)
  }
  return elements
}

function getBounds(element: SvgElement) {
  const number = (attribute: string, fallback = 0) => {
    const value = element.getAttribute(attribute)
    return value ? Number(value) : fallback
  }
  const stroke = number('stroke-width') / 2
  switch (element.tagName) {
    case 'rect': {
      const x = number('x')
      const y = number('y')
      return {
        left: x - stroke,
        top: y - stroke,
        right: x + number('width') + stroke,
        bottom: y + number('height') + stroke,
      }
    }
    case 'circle': {
      const radius = number('r')
      return {
        left: number('cx') - radius - stroke,
        top: number('cy') - radius - stroke,
        right: number('cx') + radius + stroke,
        bottom: number('cy') + radius + stroke,
      }
    }
    case 'polygon': {
      const points = (element.getAttribute('points') ?? '')
        .split(/[ ,]+/)
        .filter(Boolean)
        .map(Number)
      const xs = points.filter((_, index) => index % 2 === 0)
      const ys = points.filter((_, index) => index % 2 === 1)
      return {
        left: Math.min(...xs) - stroke,
        top: Math.min(...ys) - stroke,
        right: Math.max(...xs) + stroke,
        bottom: Math.max(...ys) + stroke,
      }
    }
    case 'path': {
      const coordinates = (element.getAttribute('d') ?? '').match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
      const xs = coordinates.filter((_, index) => index % 2 === 0)
      const ys = coordinates.filter((_, index) => index % 2 === 1)
      return {
        left: Math.min(...xs) - stroke,
        top: Math.min(...ys) - stroke,
        right: Math.max(...xs) + stroke,
        bottom: Math.max(...ys) + stroke,
      }
    }
    default:
      throw new Error(`Unexpected pattern element: ${element.tagName}`)
  }
}

function combinedBounds(elements: SvgElement[]) {
  const bounds = elements.map(getBounds)
  return {
    left: Math.min(...bounds.map((box) => box.left)),
    top: Math.min(...bounds.map((box) => box.top)),
    right: Math.max(...bounds.map((box) => box.right)),
    bottom: Math.max(...bounds.map((box) => box.bottom)),
  }
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

  it.each(BACK_DESIGNS.flatMap((design) =>
    sizes.flatMap((size) =>
      [false, true].map((border) => ({ design, size, border })),
    ),
  ))(
    'centers whole pattern cells for $design.id at $size.name with border=$border',
    ({ design, size, border }) => {
      const svg = generateBackSvg({
        design: design.id,
        width: size.width,
        height: size.height,
        primary: '#17243a',
        secondary: '#d8b15a',
        border,
      })
      const root = parseSvg(svg)
      const children = getChildren(root)
      const patternElements = children.slice(1, border ? -1 : undefined)

      expect(svg).not.toMatch(/-?\d+\.\d{4,}/)
      if (design.id === 'SOLID') {
        expect(patternElements).toHaveLength(0)
        return
      }

      const bounds = combinedBounds(patternElements)
      expect(Math.abs(bounds.left - (size.width - bounds.right))).toBeLessThanOrEqual(0.01)
      expect(Math.abs(bounds.top - (size.height - bounds.bottom))).toBeLessThanOrEqual(0.01)

      if (border) {
        const borderElement = children.at(-1)
        if (!borderElement) throw new Error('SVG has no border element.')
        const borderBounds = getBounds(borderElement)
        const gap = Math.min(size.width, size.height) * 0.01
        expect(bounds.left).toBeGreaterThanOrEqual(borderBounds.left + gap - 0.01)
        expect(bounds.top).toBeGreaterThanOrEqual(borderBounds.top + gap - 0.01)
        expect(bounds.right).toBeLessThanOrEqual(borderBounds.right - gap + 0.01)
        expect(bounds.bottom).toBeLessThanOrEqual(borderBounds.bottom - gap + 0.01)
      }
    },
  )

  it.each(sizes)('uses equal whole CROSSHATCH cells at $name size', (size) => {
    const svg = generateBackSvg({
      design: 'CROSSHATCH',
      width: size.width,
      height: size.height,
      primary: '#17243a',
      secondary: '#d8b15a',
    })
    const paths = getChildren(parseSvg(svg)).filter((element) => element.tagName === 'path')
    const dimensions = paths.map((path) => {
      const coordinates = path
        .getAttribute('d')!
        .match(/-?\d+(?:\.\d+)?/g)!
        .map(Number)
      const xs = coordinates.filter((_, index) => index % 2 === 0)
      const ys = coordinates.filter((_, index) => index % 2 === 1)
      return `${(Math.max(...xs) - Math.min(...xs)).toFixed(3)}x${(Math.max(...ys) - Math.min(...ys)).toFixed(3)}`
    })

    expect(new Set(dimensions).size).toBe(1)
  })
})
