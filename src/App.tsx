import { useEffect, useRef, useState } from 'react'
import CardEditor from './components/CardEditor.tsx'
import { CARD_PRESETS, PAPER } from './lib/geometry.ts'
import type { Card, CardSide, PixelCropRect } from './types.ts'

const SIDES: CardSide[] = ['front', 'back']

type SideState<T> = Record<CardSide, T>

function createInitialCard(): Card {
  return {
    id: 'card-1',
    ...CARD_PRESETS.POKER,
    bleedMode: 'IMAGE',
    bleedColor: '#ffffff',
    quantity: 1,
  }
}

function App() {
  const [card, setCard] = useState<Card>(createInitialCard)
  const [processedSources, setProcessedSources] = useState<SideState<string | undefined>>({
    front: undefined,
    back: undefined,
  })
  const [errors, setErrors] = useState<SideState<string | undefined>>({
    front: undefined,
    back: undefined,
  })
  const sourceUrls = useRef<SideState<string | undefined>>({
    front: undefined,
    back: undefined,
  })
  const processedUrls = useRef<SideState<string | undefined>>({
    front: undefined,
    back: undefined,
  })

  useEffect(
    () => () => {
      for (const side of SIDES) {
        const sourceUrl = sourceUrls.current[side]
        const processedUrl = processedUrls.current[side]
        if (sourceUrl) URL.revokeObjectURL(sourceUrl)
        if (processedUrl) URL.revokeObjectURL(processedUrl)
      }
    },
    [],
  )

  function clearProcessedSource(side: CardSide) {
    const previousUrl = processedUrls.current[side]
    if (previousUrl) URL.revokeObjectURL(previousUrl)
    processedUrls.current[side] = undefined
    setProcessedSources((current) => ({ ...current, [side]: undefined }))
  }

  function handleCardChange(nextCard: Card, resetCrops = false) {
    if (resetCrops) {
      for (const side of SIDES) clearProcessedSource(side)
    }
    setCard(nextCard)
  }

  function handleImageSelect(side: CardSide, file: File) {
    const sourceKey = side === 'front' ? 'frontSrc' : 'backSrc'
    const cropKey = side === 'front' ? 'frontCrop' : 'backCrop'
    const nextSourceUrl = URL.createObjectURL(file)
    const previousSourceUrl = sourceUrls.current[side]

    if (previousSourceUrl) URL.revokeObjectURL(previousSourceUrl)
    sourceUrls.current[side] = nextSourceUrl
    clearProcessedSource(side)
    setErrors((current) => ({ ...current, [side]: undefined }))
    setCard((current) => ({
      ...current,
      [sourceKey]: nextSourceUrl,
      [cropKey]: undefined,
    }))
  }

  function handleCropChange(side: CardSide, crop: PixelCropRect) {
    const cropKey = side === 'front' ? 'frontCrop' : 'backCrop'
    clearProcessedSource(side)
    setErrors((current) => ({ ...current, [side]: undefined }))
    setCard((current) => ({ ...current, [cropKey]: crop }))
  }

  function handleProcessedImage(side: CardSide, blob: Blob) {
    if (!sourceUrls.current[side]) return

    const nextProcessedUrl = URL.createObjectURL(blob)
    const previousProcessedUrl = processedUrls.current[side]
    if (previousProcessedUrl) URL.revokeObjectURL(previousProcessedUrl)
    processedUrls.current[side] = nextProcessedUrl
    setProcessedSources((current) => ({ ...current, [side]: nextProcessedUrl }))
  }

  function handleError(side: CardSide, message: string | undefined) {
    setErrors((current) => ({ ...current, [side]: message }))
  }

  return (
    <main className="min-h-screen bg-base-200 px-4 py-8 text-base-content sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              Printboard Game Cards
            </p>
            <h1 className="mt-1 text-3xl font-bold">Card editor</h1>
          </div>
          <p className="text-sm text-base-content/60">
            Letter paper · {PAPER.LETTER.width} × {PAPER.LETTER.height} pt
          </p>
        </header>

        <CardEditor
          card={card}
          processedSources={processedSources}
          errors={errors}
          onCardChange={handleCardChange}
          onImageSelect={handleImageSelect}
          onCropChange={handleCropChange}
          onProcessedImage={handleProcessedImage}
          onError={handleError}
        />
      </div>
    </main>
  )
}

export default App
