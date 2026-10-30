import { describe, expect, it, vi } from 'vitest'
import type { Card } from '../types.ts'
import { backSvgSize, mapWithConcurrency, needsStarterDeckReplacementConfirmation } from './starterDeckBuild.ts'

function createCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    bleedMode: 'IMAGE',
    frontBackground: { enabled: false, color: '#ffffff' },
    backBackground: { enabled: false, color: '#ffffff' },
    bleedColor: '#ffffff',
    quantity: 1,
    ...overrides,
  }
}

describe('mapWithConcurrency', () => {
  it('keeps results in input order and reports completed work', async () => {
    const progress: Array<[number, number]> = []
    const results = await mapWithConcurrency(
      ['first', 'second', 'third'],
      2,
      async (item, index) => {
        await new Promise((resolve) => setTimeout(resolve, (2 - index) * 5))
        return item.toUpperCase()
      },
      (done, total) => progress.push([done, total]),
    )

    expect(results).toEqual(['FIRST', 'SECOND', 'THIRD'])
    expect(progress).toEqual([[1, 3], [2, 3], [3, 3]])
  })

  it('does not exceed the requested concurrency limit', async () => {
    let active = 0
    let maximumActive = 0

    await mapWithConcurrency([0, 1, 2, 3, 4], 2, async (item) => {
      active += 1
      maximumActive = Math.max(maximumActive, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1
      return item
    })

    expect(maximumActive).toBe(2)
  })

  it('rejects on the first error and starts no more workers', async () => {
    const worker = vi.fn(async (item: number) => {
      if (item === 0) {
        await Promise.resolve()
        throw new Error('worker failed')
      }
      if (item === 1) await new Promise((resolve) => setTimeout(resolve, 10))
      return item
    })

    await expect(mapWithConcurrency([0, 1, 2, 3], 2, worker)).rejects.toThrow('worker failed')
    expect(worker.mock.calls.map(([item]) => item)).toEqual([0, 1])
  })

  it('rejects an invalid concurrency limit', async () => {
    await expect(mapWithConcurrency([1], 0, async (item) => item)).rejects.toThrow(
      'Concurrency limit must be a positive integer.',
    )
  })
})

describe('starter deck helpers', () => {
  it('scales the back SVG dimensions by four without changing the ratio', () => {
    expect(backSvgSize({ width: 180, height: 252 })).toEqual({
      width: 720,
      height: 1008,
    })
  })

  it('asks before replacing a non-empty starter deck', () => {
    expect(needsStarterDeckReplacementConfirmation([])).toBe(false)
    expect(needsStarterDeckReplacementConfirmation([createCard()])).toBe(false)
    expect(needsStarterDeckReplacementConfirmation([createCard({ frontSrc: '/front.svg' })])).toBe(
      true,
    )
    expect(
      needsStarterDeckReplacementConfirmation([
        createCard(),
        createCard({ id: 'card-2' }),
      ]),
    ).toBe(true)
    expect(
      needsStarterDeckReplacementConfirmation([
        createCard({ backBackground: { enabled: true, color: '#ffffff' } }),
      ]),
    ).toBe(true)
  })
})
