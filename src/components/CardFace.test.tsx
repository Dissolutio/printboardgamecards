import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import CardFace from './CardFace.tsx'
import type { Card } from '../types.ts'

const transparentPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII='

const card: Card = {
  id: 'two-sided',
  bleedMode: 'IMAGE',
  frontProcessedSrc: transparentPng,
  backProcessedSrc: transparentPng,
  frontBackground: { enabled: true, color: '#ff0000' },
  backBackground: { enabled: true, color: '#0000ff' },
  bleedColor: '#00ff00',
  quantity: 1,
}

function renderFace(side: 'front' | 'back', showBleedRing = false) {
  return renderToStaticMarkup(
    <CardFace
      card={card}
      side={side}
      cardSize={{ width: 180, height: 252 }}
      showBleedRing={showBleedRing}
      source={side === 'front' ? card.frontProcessedSrc : card.backProcessedSrc}
    />,
  )
}

describe('CardFace', () => {
  it('uses the appropriate side background and fills the portrait face', () => {
    const front = renderFace('front')
    const back = renderFace('back')

    expect(front).toContain('aspect-ratio:180 / 252')
    expect(front).toContain('background-color:#ff0000')
    expect(front).toContain('object-fit:fill')
    expect(back).toContain('background-color:#0000ff')
    expect(back).toContain('object-fit:fill')
  })

  it('uses the bleed-area aspect ratio when showing the bleed ring', () => {
    expect(renderFace('front', true)).toContain('aspect-ratio:198 / 270')
  })

  it('uses a paper-colored placeholder instead of an unset side bleed color', () => {
    const cardWithoutBack: Card = {
      id: 'empty-back',
      bleedMode: 'COLOR',
      frontBackground: { enabled: false, color: '#ffffff' },
      backBackground: { enabled: false, color: '#ffffff' },
      bleedColor: '#00ff00',
      quantity: 1,
    }
    const markup = renderToStaticMarkup(
      <CardFace
        card={cardWithoutBack}
        side="back"
        cardSize={{ width: 180, height: 252 }}
        showBleedRing
      />,
    )

    expect(markup).toContain('No back image')
    expect(markup).toContain('background-color:#ffffff')
    expect(markup).not.toContain('#00ff00')
  })

  it('shows a background without visible text and gives it an accessible name', () => {
    const colorOnlyCard: Card = {
      ...card,
      frontProcessedSrc: undefined,
      backProcessedSrc: undefined,
      frontSrc: undefined,
      backSrc: undefined,
    }
    const markup = renderToStaticMarkup(
      <CardFace
        card={colorOnlyCard}
        side="back"
        cardSize={{ width: 180, height: 252 }}
        showBleedRing={false}
      />,
    )

    expect(markup).toContain('role="img"')
    expect(markup).toContain('aria-label="Back side: background color, no image."')
    expect(markup).not.toContain('No back image')
  })

  it('shows no placeholder text when an image is present', () => {
    const markup = renderFace('front')
    expect(markup).not.toContain('No front image')
    expect(markup).not.toContain('Crop required')
  })

  it('keeps the crop-required placeholder for an unprocessed source image', () => {
    const markup = renderToStaticMarkup(
      <CardFace
        card={{ ...card, frontProcessedSrc: undefined }}
        side="front"
        cardSize={{ width: 180, height: 252 }}
        showBleedRing={false}
        placeholder="Crop required"
      />,
    )

    expect(markup).toContain('Crop required')
  })
})
