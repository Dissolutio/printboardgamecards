import type { Card } from '../types.ts'

const allowedDataSource =
  /^data:image\/(?:png|jpeg|webp|gif|svg\+xml)(?:[;,]|$)/i

export function findDisallowedSources(
  cards: Card[],
  allowedStaticPrefix: string,
): string | undefined {
  for (const [index, card] of cards.entries()) {
    for (const side of ['front', 'back'] as const) {
      const source = side === 'front' ? card.frontSrc : card.backSrc
      if (
        source !== undefined &&
        !allowedDataSource.test(source) &&
        !source.startsWith(allowedStaticPrefix)
      ) {
        return `card ${index + 1} ${side} source must be a supported image or app image.`
      }
    }
  }
  return undefined
}
