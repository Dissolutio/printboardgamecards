import type { ReactNode } from 'react'
import { DEFAULT_BLEED, type Size } from '../lib/geometry.ts'
import { backgroundFor, hasBackground } from '../lib/piece.ts'
import { accessibleFaceName, emptyFaceLabel } from '../lib/faceLabel.ts'
import type { Card, CardSide } from '../types.ts'

type CardFaceProps = {
  card: Card
  side: CardSide
  cardSize: Size
  showBleedRing: boolean
  aspectIncludesBleed?: boolean
  source?: string
  placeholder?: 'Crop required'
  alt?: string
  className?: string
  children?: ReactNode
}

export default function CardFace({
  card,
  side,
  cardSize,
  showBleedRing,
  aspectIncludesBleed,
  source,
  placeholder,
  alt,
  className,
  children,
}: CardFaceProps) {
  const imageSource =
    source ?? (side === 'front' ? card.frontProcessedSrc : card.backProcessedSrc)
  const sourceImage = side === 'front' ? card.frontSrc : card.backSrc
  const backgroundColor = backgroundFor(card, side)
  const hasImage = Boolean(imageSource || sourceImage)
  const hasSideBackground = hasBackground(card, side)
  const placeholderText =
    placeholder ??
    emptyFaceLabel({ side, hasImage, hasBackground: hasSideBackground })
  const faceName =
    !placeholder && !imageSource
      ? accessibleFaceName({ side, hasImage, hasBackground: hasSideBackground })
      : undefined
  const shouldShowBleedRing =
    showBleedRing && (hasImage || hasSideBackground)
  const includesBleed = aspectIncludesBleed ?? showBleedRing
  const faceWidth = cardSize.width + (includesBleed ? 2 * DEFAULT_BLEED : 0)
  const faceHeight = cardSize.height + (includesBleed ? 2 * DEFAULT_BLEED : 0)
  const inset = shouldShowBleedRing
    ? {
        left: `${(DEFAULT_BLEED / faceWidth) * 100}%`,
        top: `${(DEFAULT_BLEED / faceHeight) * 100}%`,
        right: `${(DEFAULT_BLEED / faceWidth) * 100}%`,
        bottom: `${(DEFAULT_BLEED / faceHeight) * 100}%`,
      }
    : { left: 0, top: 0, right: 0, bottom: 0 }

  return (
    <div
      className={`relative w-full overflow-hidden ${className ?? ''}`}
      role={faceName ? 'img' : undefined}
      aria-label={faceName}
      style={{
        aspectRatio: `${faceWidth} / ${faceHeight}`,
        backgroundColor: shouldShowBleedRing ? card.bleedColor : backgroundColor,
      }}
    >
      <div
        className="absolute overflow-hidden"
        style={{ ...inset, backgroundColor }}
      >
        {children ??
          (imageSource ? (
            <img
              className="block h-full w-full"
              src={imageSource}
              alt={alt ?? `${side} card`}
              style={{ objectFit: 'fill' }}
            />
          ) : placeholderText ? (
            <span className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-base-content/60">
              {placeholderText}
            </span>
          ) : null)}
      </div>
    </div>
  )
}
