import type { Card, CardSide, PixelCropRect } from '../types.ts'

const scaleGapFormat = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
})
const scalePercentFormat = new Intl.NumberFormat(undefined, {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

export function expectedScaleTotalMessage(value: number): string {
  return `The expected total is ${scaleGapFormat.format(value)} tick spaces.`
}

export function estimatedScaleMessage(value: number): string {
  return `Estimated printer scale is ${scalePercentFormat.format(value)}.`
}

export function createCard(id: string, previous?: Card): Card {
  return {
    id,
    bleedMode: previous?.bleedMode ?? 'IMAGE',
    frontBackground: previous?.frontBackground ?? { enabled: false, color: '#ffffff' },
    backBackground: previous?.backBackground ?? { enabled: false, color: '#ffffff' },
    bleedColor: previous?.bleedColor ?? '#ffffff',
    quantity: 1,
  }
}

export function objectUrls(card: Card): string[] {
  return [
    card.frontSrc,
    card.backSrc,
    card.frontProcessedSrc,
    card.backProcessedSrc,
  ].filter((url): url is string => url !== undefined && url.startsWith('blob:'))
}

export function sideSource(card: Card, side: CardSide): string | undefined {
  return side === 'front' ? card.frontSrc : card.backSrc
}

export function sideCrop(card: Card, side: CardSide): PixelCropRect | undefined {
  return side === 'front' ? card.frontCrop : card.backCrop
}

export function sideProcessedSource(card: Card, side: CardSide): string | undefined {
  return side === 'front' ? card.frontProcessedSrc : card.backProcessedSrc
}

export function withSideCrop(
  card: Card,
  side: CardSide,
  crop: PixelCropRect | undefined,
  processedSource: string | undefined,
): Card {
  return side === 'front'
    ? { ...card, frontCrop: crop, frontProcessedSrc: processedSource }
    : { ...card, backCrop: crop, backProcessedSrc: processedSource }
}

export function downloadBlob(blob: Blob, filename: string) {
  const downloadUrl = URL.createObjectURL(blob)

  try {
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
  }
}
