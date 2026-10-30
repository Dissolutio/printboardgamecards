import type { Card } from '../types.ts'
import type { Size } from './geometry.ts'

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError('Concurrency limit must be a positive integer.')
  }

  const results: R[] = []
  let nextIndex = 0
  let completed = 0
  let failed = false
  let firstError: unknown

  async function runWorker() {
    while (!failed) {
      const index = nextIndex
      if (index >= items.length) return
      nextIndex += 1

      try {
        results[index] = await worker(items[index], index)
        completed += 1
        onProgress?.(completed, items.length)
      } catch (error) {
        if (!failed) {
          failed = true
          firstError = error
        }
        return
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runWorker()),
  )
  if (failed) throw firstError
  return results
}

export function backSvgSize(cardSize: Size): Size {
  return { width: cardSize.width * 4, height: cardSize.height * 4 }
}

export function needsStarterDeckReplacementConfirmation(cards: Card[]): boolean {
  if (cards.length > 1) return true
  const firstCard = cards[0]
  if (!firstCard) return false

  return Boolean(
    firstCard.frontSrc ||
      firstCard.backSrc ||
      firstCard.frontProcessedSrc ||
      firstCard.backProcessedSrc ||
      firstCard.frontBackground.enabled ||
      firstCard.backBackground.enabled,
  )
}
