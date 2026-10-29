export type BackDesignId =
  | 'SOLID'
  | 'LATTICE'
  | 'STRIPES'
  | 'DOTS'
  | 'FRAME'
  | 'CROSSHATCH'

export const BACK_DESIGNS = [
  { id: 'SOLID', name: 'Solid' },
  { id: 'LATTICE', name: 'Lattice' },
  { id: 'STRIPES', name: 'Stripes' },
  { id: 'DOTS', name: 'Dots' },
  { id: 'FRAME', name: 'Frame' },
  { id: 'CROSSHATCH', name: 'Crosshatch' },
] as const satisfies readonly { id: BackDesignId; name: string }[]

export const BACK_PALETTES = [
  { id: 'NAVY_GOLD', name: 'Navy & Gold', primary: '#17243a', secondary: '#d8b15a' },
  { id: 'CRIMSON_CREAM', name: 'Crimson & Cream', primary: '#8b2332', secondary: '#f5e8ca' },
  { id: 'FOREST_SAND', name: 'Forest & Sand', primary: '#244c3a', secondary: '#d9c49a' },
  { id: 'CHARCOAL_SILVER', name: 'Charcoal & Silver', primary: '#303238', secondary: '#c4c7cc' },
  { id: 'PLUM_ROSE', name: 'Plum & Rose', primary: '#53334f', secondary: '#e5b9c9' },
  { id: 'TEAL_IVORY', name: 'Teal & Ivory', primary: '#176b70', secondary: '#f2ead8' },
] as const

type BackSvgOptions = {
  design: BackDesignId
  width: number
  height: number
  primary: string
  secondary: string
  border?: boolean
}

function normalizeColor(color: string): string {
  if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) {
    throw new RangeError('Colors must be hexadecimal values in #rgb or #rrggbb format.')
  }

  const lowercase = color.toLowerCase()
  return lowercase.length === 4
    ? `#${lowercase[1]}${lowercase[1]}${lowercase[2]}${lowercase[2]}${lowercase[3]}${lowercase[3]}`
    : lowercase
}

function rounded(value: number): number {
  return Math.round(value * 1000) / 1000
}

function formatNumber(value: number): string {
  const result = rounded(value)
  return Object.is(result, -0) ? '0' : String(result)
}

function centeredGrid(
  bounds: { x: number; y: number; width: number; height: number },
  step: number,
  extent: number,
): { x: number; y: number; cols: number; rows: number } {
  const width = Math.max(0, bounds.width - extent * 2)
  const height = Math.max(0, bounds.height - extent * 2)
  const cols = Math.floor(width / step)
  const rows = Math.floor(height / step)
  return {
    x: bounds.x + extent + (width - cols * step) / 2,
    y: bounds.y + extent + (height - rows * step) / 2,
    cols,
    rows,
  }
}

function evenlySpacedPositions(start: number, end: number, step: number): number[] {
  const span = Math.max(0, end - start)
  const count = Math.floor(span / step) + 1
  const used = (count - 1) * step
  const first = start + (span - used) / 2
  return Array.from({ length: count }, (_, index) => first + index * step)
}

export function generateBackSvg({
  design,
  width,
  height,
  primary,
  secondary,
  border = false,
}: BackSvgOptions): string {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new RangeError('SVG width and height must be positive finite numbers.')
  }

  const background = normalizeColor(primary)
  const accent = normalizeColor(secondary)
  const scale = Math.min(width, height)
  const svgWidth = formatNumber(width)
  const svgHeight = formatNumber(height)
  const borderInset = scale * 0.025
  const borderStroke = rounded(scale * 0.006)
  const patternGap = scale * 0.01
  const bounds = border
    ? {
        x: borderInset + borderStroke / 2 + patternGap,
        y: borderInset + borderStroke / 2 + patternGap,
        width: width - 2 * (borderInset + borderStroke / 2 + patternGap),
        height: height - 2 * (borderInset + borderStroke / 2 + patternGap),
      }
    : { x: 0, y: 0, width, height }
  const elements = [
    `<rect width="${svgWidth}" height="${svgHeight}" fill="${background}"/>`,
  ]

  switch (design) {
    case 'SOLID':
      break
    case 'LATTICE': {
      const step = rounded(scale * 0.18)
      const stroke = rounded(scale * 0.006)
      const grid = centeredGrid(bounds, step, stroke / 2)
      for (let row = 0; row < grid.rows; row += 1) {
        const y = grid.y + row * step
        for (let col = 0; col < grid.cols; col += 1) {
          const x = grid.x + col * step
          const half = step / 2
          elements.push(
            `<polygon points="${formatNumber(x + half)},${formatNumber(y)} ${formatNumber(x + step)},${formatNumber(y + half)} ${formatNumber(x + half)},${formatNumber(y + step)} ${formatNumber(x)},${formatNumber(y + half)}" fill="none" stroke="${accent}" stroke-width="${formatNumber(stroke)}"/>`,
          )
        }
      }
      break
    }
    case 'STRIPES': {
      const nominalStep = scale * 0.16
      let count = Math.max(1, Math.floor(bounds.width / nominalStep))
      if (count % 2 === 0) count -= 1
      const bandWidth = rounded(bounds.width / (count * 2))
      const firstX = bounds.x + bandWidth / 2
      for (let index = 0; index < count; index += 1) {
        const x = firstX + index * bandWidth * 2
        elements.push(
          `<rect x="${formatNumber(x)}" width="${formatNumber(bandWidth)}" y="${formatNumber(bounds.y)}" height="${formatNumber(bounds.height)}" fill="${accent}"/>`,
        )
      }
      break
    }
    case 'DOTS': {
      const step = rounded(scale * 0.12)
      const radius = rounded(scale * 0.018)
      const usableWidth = Math.max(0, bounds.width - radius * 2)
      const usableHeight = Math.max(0, bounds.height - radius * 2)
      const cols = Math.floor(usableWidth / step) + 1
      const rows = Math.floor(usableHeight / step) + 1
      const spanX = (cols - 1) * step
      const spanY = (rows - 1) * step
      const firstX = bounds.x + radius + (usableWidth - spanX) / 2
      const firstY = bounds.y + radius + (usableHeight - spanY) / 2
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          elements.push(
            `<circle cx="${formatNumber(firstX + col * step)}" cy="${formatNumber(firstY + row * step)}" r="${formatNumber(radius)}" fill="${accent}"/>`,
          )
        }
      }
      break
    }
    case 'FRAME': {
      const inset = scale * 0.075
      const stroke = rounded(scale * 0.012)
      const radius = scale * 0.035
      const motifRadius = rounded(scale * 0.012)
      const motifStep = rounded(scale * 0.09)
      const left = bounds.x + inset + stroke / 2
      const top = bounds.y + inset + stroke / 2
      const right = bounds.x + bounds.width - inset - stroke / 2
      const bottom = bounds.y + bounds.height - inset - stroke / 2
      const cornerClearance = radius + motifRadius * 2
      const horizontalPositions = evenlySpacedPositions(
        left + cornerClearance,
        right - cornerClearance,
        motifStep,
      )
      const verticalPositions = evenlySpacedPositions(
        top + cornerClearance,
        bottom - cornerClearance,
        motifStep,
      )
      elements.push(
        `<rect x="${formatNumber(left)}" y="${formatNumber(top)}" width="${formatNumber(right - left)}" height="${formatNumber(bottom - top)}" rx="${formatNumber(radius)}" fill="none" stroke="${accent}" stroke-width="${formatNumber(stroke)}"/>`,
      )
      for (const x of horizontalPositions) {
        elements.push(
          `<circle cx="${formatNumber(x)}" cy="${formatNumber(top)}" r="${formatNumber(motifRadius)}" fill="${accent}"/>`,
        )
        elements.push(
          `<circle cx="${formatNumber(x)}" cy="${formatNumber(bottom)}" r="${formatNumber(motifRadius)}" fill="${accent}"/>`,
        )
      }
      for (const y of verticalPositions) {
        elements.push(
          `<circle cx="${formatNumber(left)}" cy="${formatNumber(y)}" r="${formatNumber(motifRadius)}" fill="${accent}"/>`,
        )
        elements.push(
          `<circle cx="${formatNumber(right)}" cy="${formatNumber(y)}" r="${formatNumber(motifRadius)}" fill="${accent}"/>`,
        )
      }
      break
    }
    case 'CROSSHATCH': {
      const stroke = rounded(scale * 0.006)
      const step = rounded(scale * 0.15)
      const grid = centeredGrid(bounds, step, stroke / 2)
      for (let row = 0; row < grid.rows; row += 1) {
        const y = grid.y + row * step
        for (let col = 0; col < grid.cols; col += 1) {
          const x = grid.x + col * step
          elements.push(
            `<path d="M ${formatNumber(x)} ${formatNumber(y)} L ${formatNumber(x + step)} ${formatNumber(y + step)} M ${formatNumber(x + step)} ${formatNumber(y)} L ${formatNumber(x)} ${formatNumber(y + step)}" fill="none" stroke="${accent}" stroke-width="${formatNumber(stroke)}"/>`,
          )
        }
      }
      break
    }
    default:
      throw new RangeError('Unknown back design.')
  }

  if (border) {
    elements.push(
      `<rect x="${formatNumber(borderInset)}" y="${formatNumber(borderInset)}" width="${formatNumber(width - borderInset * 2)}" height="${formatNumber(height - borderInset * 2)}" fill="none" stroke="${accent}" stroke-width="${formatNumber(borderStroke)}"/>`,
    )
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">${elements.join('')}</svg>`
}

export function backSvgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
