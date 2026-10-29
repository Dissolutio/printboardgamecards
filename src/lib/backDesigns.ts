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
  const elements = [`<rect width="${width}" height="${height}" fill="${background}"/>`]

  switch (design) {
    case 'SOLID':
      break
    case 'LATTICE': {
      const step = scale * 0.18
      const inset = scale * 0.015
      for (let y = inset; y + step <= height - inset; y += step) {
        for (let x = inset; x + step <= width - inset; x += step) {
          const half = step / 2
          elements.push(
            `<polygon points="${x + half},${y} ${x + step},${y + half} ${x + half},${y + step} ${x},${y + half}" fill="none" stroke="${accent}" stroke-width="${scale * 0.006}"/>`,
          )
        }
      }
      break
    }
    case 'STRIPES': {
      const step = scale * 0.16
      const bandWidth = step / 2
      for (let x = 0, index = 0; x < width; x += step, index += 1) {
        if (index % 2 === 0) {
          elements.push(
            `<rect x="${x}" width="${Math.min(bandWidth, width - x)}" height="${height}" fill="${accent}"/>`,
          )
        }
      }
      break
    }
    case 'DOTS': {
      const step = scale * 0.12
      const radius = scale * 0.018
      for (let y = radius * 2; y <= height - radius * 2; y += step) {
        for (let x = radius * 2; x <= width - radius * 2; x += step) {
          elements.push(`<circle cx="${x}" cy="${y}" r="${radius}" fill="${accent}"/>`)
        }
      }
      break
    }
    case 'FRAME': {
      const inset = scale * 0.075
      const stroke = scale * 0.012
      const radius = scale * 0.035
      const motifRadius = scale * 0.012
      const motifStep = scale * 0.09
      elements.push(
        `<rect x="${inset}" y="${inset}" width="${width - inset * 2}" height="${height - inset * 2}" rx="${radius}" fill="none" stroke="${accent}" stroke-width="${stroke}"/>`,
      )
      for (let x = inset + radius; x <= width - inset - radius; x += motifStep) {
        elements.push(`<circle cx="${x}" cy="${inset}" r="${motifRadius}" fill="${accent}"/>`)
        elements.push(
          `<circle cx="${x}" cy="${height - inset}" r="${motifRadius}" fill="${accent}"/>`,
        )
      }
      for (let y = inset + radius + motifStep; y < height - inset - radius; y += motifStep) {
        elements.push(`<circle cx="${inset}" cy="${y}" r="${motifRadius}" fill="${accent}"/>`)
        elements.push(
          `<circle cx="${width - inset}" cy="${y}" r="${motifRadius}" fill="${accent}"/>`,
        )
      }
      break
    }
    case 'CROSSHATCH': {
      const stroke = scale * 0.006
      const step = scale * 0.15
      const inset = stroke
      for (let y = inset; y < height - inset; y += step) {
        const cellHeight = Math.min(step, height - inset - y)
        for (let x = inset; x < width - inset; x += step) {
          const cellWidth = Math.min(step, width - inset - x)
          elements.push(
            `<path d="M ${x} ${y} L ${x + cellWidth} ${y + cellHeight} M ${x + cellWidth} ${y} L ${x} ${y + cellHeight}" fill="none" stroke="${accent}" stroke-width="${stroke}"/>`,
          )
        }
      }
      break
    }
    default:
      throw new RangeError('Unknown back design.')
  }

  if (border) {
    const inset = scale * 0.025
    const stroke = scale * 0.006
    elements.push(
      `<rect x="${inset}" y="${inset}" width="${width - inset * 2}" height="${height - inset * 2}" fill="none" stroke="${accent}" stroke-width="${stroke}"/>`,
    )
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${elements.join('')}</svg>`
}

export function backSvgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
