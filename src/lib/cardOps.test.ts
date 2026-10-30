import { describe, expect, it } from 'vitest'
import {
  createCard,
  estimatedScaleMessage,
  expectedScaleTotalMessage,
  objectUrls,
  sideCrop,
  sideProcessedSource,
  sideSource,
  withSideCrop,
} from './cardOps.ts'
import type { Card } from '../types.ts'

describe('card operations', () => {
  it('creates a card with defaults inherited from the previous card', () => {
    const previous = {
      ...createCard('previous'),
      bleedMode: 'COLOR' as const,
      frontBackground: { enabled: true, color: '#123456' },
      bleedColor: '#abcdef',
    }

    expect(createCard('next', previous)).toEqual({
      ...previous,
      id: 'next',
      quantity: 1,
    })
  })

  it('tracks only blob URLs for revocation', () => {
    const card: Card = {
      ...createCard('card'),
      frontSrc: 'blob:front',
      backSrc: 'https://example.test/back.png',
      frontProcessedSrc: 'blob:processed',
      backProcessedSrc: 'data:image/png;base64,abc',
    }

    expect(objectUrls(card)).toEqual(['blob:front', 'blob:processed'])
  })

  it('reads and updates the requested side fields', () => {
    const crop = { x: 1, y: 2, width: 3, height: 4 }
    const card: Card = {
      ...createCard('card'),
      frontSrc: 'front.png',
      backSrc: 'back.png',
      frontCrop: crop,
      frontProcessedSrc: 'front-processed.png',
    }

    expect(sideSource(card, 'front')).toBe('front.png')
    expect(sideSource(card, 'back')).toBe('back.png')
    expect(sideCrop(card, 'front')).toBe(crop)
    expect(sideCrop(card, 'back')).toBeUndefined()
    expect(sideProcessedSource(card, 'front')).toBe('front-processed.png')
    expect(withSideCrop(card, 'back', crop, 'back-processed.png')).toMatchObject({
      frontCrop: crop,
      frontProcessedSrc: 'front-processed.png',
      backCrop: crop,
      backProcessedSrc: 'back-processed.png',
    })
  })

  it('formats scale messages with the current locale', () => {
    expect(expectedScaleTotalMessage(12)).toBe(
      `The expected total is ${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(12)}.`,
    )
    expect(estimatedScaleMessage(1)).toBe(
      `Estimated printer scale is ${new Intl.NumberFormat(undefined, {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(1)}.`,
    )
  })
})
