import { effectiveDpi } from './crop.ts'

export function isSvgFile(file: { type: string; name: string }): boolean {
  return file.type.toLowerCase() === 'image/svg+xml'
    || (file.type === '' && file.name.toLowerCase().endsWith('.svg'))
}

export function isSvgUrl(url: string): boolean {
  if (/^data:image\/svg\+xml(?:[;,]|$)/i.test(url)) return true
  if (/^blob:/i.test(url)) return false

  try {
    const parsedUrl = new URL(url)
    if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
      return parsedUrl.pathname.toLowerCase().endsWith('.svg')
    }
    if (parsedUrl.protocol) return false
  } catch {
    // Relative URLs are not accepted by URL without a base.
  }

  return url.split(/[?#]/, 1)[0].toLowerCase().endsWith('.svg')
}

export function effectiveDpiForSource({
  cropPixelWidth,
  areaWidthPt,
  isVector,
}: {
  cropPixelWidth: number
  areaWidthPt: number
  isVector: boolean
}): number | undefined {
  return isVector ? undefined : effectiveDpi(cropPixelWidth, areaWidthPt)
}
