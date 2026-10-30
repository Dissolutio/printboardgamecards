import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import {
  addCard,
  deleteCard,
  duplicateCard,
  stepQuantity,
} from '../lib/deck.ts'
import { createCard, objectUrls } from '../lib/cardOps.ts'
import {
  CARD_PRESETS,
  DEFAULT_BLEED,
} from '../lib/geometry.ts'
import { cropAreaSize } from '../lib/crop.ts'
import { centeredMaximumCrop } from '../lib/cropConvert.ts'
import { planBackSync } from '../lib/backSync.ts'
import { getImageType } from '../lib/imageType.ts'
import { loadImageSize, renderCrop } from '../lib/renderCrop.ts'
import { isSvgFile } from '../lib/vectorSource.ts'
import type { Card, CardSide, PixelCropRect } from '../types.ts'

type PresetName = keyof typeof CARD_PRESETS
type QuantityDirection = -1 | 1

function revokeUnusedUrls(candidates: string[], remainingCards: Card[]) {
  const retained = new Set(remainingCards.flatMap(objectUrls))
  for (const url of new Set(candidates)) {
    if (url.startsWith('blob:') && !retained.has(url)) URL.revokeObjectURL(url)
  }
}

export function useCards({
  appliedPreset,
  presetInProgress,
  projectOperationInProgress,
  starterDeckOperationInProgress,
  isExporting,
}: {
  appliedPreset: MutableRefObject<PresetName>
  presetInProgress: MutableRefObject<boolean>
  projectOperationInProgress: MutableRefObject<boolean>
  starterDeckOperationInProgress: MutableRefObject<boolean>
  isExporting: boolean
}) {
  const [cards, setCards] = useState<Card[]>(() => [createCard('card-1')])
  const cardsRef = useRef(cards)
  const cardOperationTokens = useRef(new Map<string, number>())
  const [selectedId, setSelectedId] = useState('card-1')
  const [errors, setErrors] = useState<Record<CardSide, string | undefined>>({
    front: undefined,
    back: undefined,
  })

  useEffect(
    () => () => {
      const urls = new Set(cardsRef.current.flatMap(objectUrls))
      for (const url of urls) URL.revokeObjectURL(url)
    },
    [],
  )

  function replaceCards(nextCards: Card[]) {
    cardsRef.current = nextCards
    setCards(nextCards)
  }

  function releaseUnusedUrls(candidates: string[], remainingCards: Card[]) {
    revokeUnusedUrls(candidates, remainingCards)
  }

  function updateCard(nextCard: Card) {
    if (starterDeckOperationInProgress.current) return
    const currentCards = cardsRef.current
    const nextCards = currentCards.map((card) => (card.id === nextCard.id ? nextCard : card))
    replaceCards(nextCards)
  }

  function handleQuantityStep(cardId: string, direction: QuantityDirection) {
    if (starterDeckOperationInProgress.current) return
    const currentCard = cardsRef.current.find((card) => card.id === cardId)
    if (!currentCard) return

    updateCard({
      ...currentCard,
      quantity: stepQuantity(currentCard.quantity, direction),
    })
  }

  function beginCardOperation(cardId: string): number {
    const token = (cardOperationTokens.current.get(cardId) ?? 0) + 1
    cardOperationTokens.current.set(cardId, token)
    return token
  }

  function isCurrentCardOperation(cardId: string, token: number): boolean {
    return cardOperationTokens.current.get(cardId) === token
  }

  function handleAddCard() {
    const card = createCard(crypto.randomUUID(), cardsRef.current.at(-1))
    replaceCards(addCard(cardsRef.current, card))
    setSelectedId(card.id)
    setErrors({ front: undefined, back: undefined })
  }

  function handleDuplicateCard(cardId: string) {
    const duplicateId = crypto.randomUUID()
    const nextCards = duplicateCard(cardsRef.current, cardId, duplicateId)
    replaceCards(nextCards)
    setSelectedId(duplicateId)
    setErrors({ front: undefined, back: undefined })
  }

  function handleDeleteCard(cardId: string) {
    const currentCards = cardsRef.current
    const removedCard = currentCards.find((card) => card.id === cardId)
    const nextCards = deleteCard(currentCards, cardId)
    replaceCards(nextCards)
    if (removedCard) releaseUnusedUrls(objectUrls(removedCard), nextCards)

    if (selectedId === cardId) {
      setSelectedId(nextCards[0]?.id ?? '')
      setErrors({ front: undefined, back: undefined })
    }
  }

  function handleImageSelect(side: CardSide, file: File) {
    const currentCard = cardsRef.current.find((card) => card.id === selectedId)
    if (!currentCard) return

    const sourceKey = side === 'front' ? 'frontSrc' : 'backSrc'
    const vectorKey = side === 'front' ? 'frontIsVector' : 'backIsVector'
    const processedKey = side === 'front' ? 'frontProcessedSrc' : 'backProcessedSrc'
    const cropKey = side === 'front' ? 'frontCrop' : 'backCrop'
    const operationToken = beginCardOperation(currentCard.id)
    const presetForOperation = appliedPreset.current
    const type = getImageType(file)
    const sourceFile =
      (!file.type || file.type.toLowerCase() === 'application/octet-stream') && type
        ? new Blob([file], { type })
        : file
    const nextSourceUrl = URL.createObjectURL(sourceFile)
    setErrors((current) => ({ ...current, [side]: undefined }))

    void (async () => {
      let nextProcessedUrl: string | undefined
      try {
        const imageSize = await loadImageSize(nextSourceUrl)
        const operationCardSize = CARD_PRESETS[presetForOperation]
        const areaSize = cropAreaSize(
          operationCardSize,
          DEFAULT_BLEED,
          currentCard.bleedMode,
        )
        const crop = centeredMaximumCrop(imageSize, areaSize)
        const blob = await renderCrop(nextSourceUrl, crop, areaSize)
        nextProcessedUrl = URL.createObjectURL(blob)

        const latestCard = cardsRef.current.find((card) => card.id === currentCard.id)
        if (
          !isCurrentCardOperation(currentCard.id, operationToken) ||
          appliedPreset.current !== presetForOperation ||
          !latestCard ||
          latestCard[sourceKey] !== currentCard[sourceKey]
        ) {
          URL.revokeObjectURL(nextSourceUrl)
          URL.revokeObjectURL(nextProcessedUrl)
          return
        }

        const nextCard = {
          ...latestCard,
          [sourceKey]: nextSourceUrl,
          [vectorKey]: isSvgFile(file),
          [processedKey]: nextProcessedUrl,
          [cropKey]: crop,
        }
        const nextCards = cardsRef.current.map((card) =>
          card.id === latestCard.id ? nextCard : card,
        )
        replaceCards(nextCards)
        releaseUnusedUrls(
          [latestCard[sourceKey], latestCard[processedKey]].filter(
            (url): url is string => url !== undefined,
          ),
          nextCards,
        )
      } catch (error) {
        URL.revokeObjectURL(nextSourceUrl)
        if (nextProcessedUrl) URL.revokeObjectURL(nextProcessedUrl)
        if (isCurrentCardOperation(currentCard.id, operationToken)) {
          setErrors((current) => ({
            ...current,
            [side]: error instanceof Error
              ? error.message
              : 'Could not process this image.',
          }))
        }
      }
    })()
  }

  function handleImageRemove(side: CardSide) {
    const currentCard = cardsRef.current.find((card) => card.id === selectedId)
    if (!currentCard) return

    const sourceKey = side === 'front' ? 'frontSrc' : 'backSrc'
    const vectorKey = side === 'front' ? 'frontIsVector' : 'backIsVector'
    const processedKey = side === 'front' ? 'frontProcessedSrc' : 'backProcessedSrc'
    const cropKey = side === 'front' ? 'frontCrop' : 'backCrop'
    beginCardOperation(currentCard.id)

    const nextCard = {
      ...currentCard,
      [sourceKey]: undefined,
      [vectorKey]: false,
      [processedKey]: undefined,
      [cropKey]: undefined,
    }
    const nextCards = cardsRef.current.map((card) =>
      card.id === currentCard.id ? nextCard : card,
    )
    replaceCards(nextCards)
    releaseUnusedUrls(
      [currentCard[sourceKey], currentCard[processedKey]].filter(
        (url): url is string => url !== undefined,
      ),
      nextCards,
    )
    setErrors((current) => ({ ...current, [side]: undefined }))
  }

  function handleCropChange(side: CardSide, crop: PixelCropRect) {
    if (starterDeckOperationInProgress.current) return
    const currentCard = cardsRef.current.find((card) => card.id === selectedId)
    if (!currentCard) return

    const cropKey = side === 'front' ? 'frontCrop' : 'backCrop'
    const processedKey = side === 'front' ? 'frontProcessedSrc' : 'backProcessedSrc'
    beginCardOperation(currentCard.id)
    const nextCard = { ...currentCard, [cropKey]: crop, [processedKey]: undefined }
    const nextCards = cardsRef.current.map((card) =>
      card.id === currentCard.id ? nextCard : card,
    )
    replaceCards(nextCards)
    if (currentCard[processedKey]) {
      releaseUnusedUrls([currentCard[processedKey]], nextCards)
    }
    setErrors((current) => ({ ...current, [side]: undefined }))
  }

  async function handleUseBackForEveryCard() {
    const originalCards = cardsRef.current
    const selected = originalCards.find((card) => card.id === selectedId)
    if (
      !selected?.backSrc ||
      !selected.backCrop ||
      presetInProgress.current ||
      projectOperationInProgress.current ||
      isExporting ||
      starterDeckOperationInProgress.current
    ) {
      return
    }

    const plan = planBackSync(selected, originalCards)
    if (plan.cardsToUpdate.length === 0) return
    if (
      plan.needsConfirmation &&
      !window.confirm('Replace the back of every other card with this back? This cannot be undone.')
    ) {
      return
    }

    const processedSource = selected.backProcessedSrc
    if (!processedSource) {
      setErrors((current) => ({
        ...current,
        back: 'Could not read the selected back image. Try again.',
      }))
      return
    }

    const tokens = new Map(
      originalCards.map((card) => [card.id, beginCardOperation(card.id)]),
    )
    const presetForOperation = appliedPreset.current
    const generatedUrls: string[] = []
    const selectedBackCrop = { ...selected.backCrop }
    try {
      const response = await fetch(processedSource)
      if (!response.ok) throw new Error('Could not read the selected back image.')
      const processedBlob = await response.blob()
      const nextCards = originalCards.map((card) => {
        if (card.id === selected.id) return card
        const nextProcessedSource = URL.createObjectURL(
          new Blob([processedBlob], { type: processedBlob.type }),
        )
        generatedUrls.push(nextProcessedSource)
        return {
          ...card,
          backSrc: selected.backSrc,
          backCrop: { ...selectedBackCrop },
          backIsVector: selected.backIsVector,
          backProcessedSrc: nextProcessedSource,
        }
      })

      if (
        cardsRef.current !== originalCards ||
        appliedPreset.current !== presetForOperation ||
        originalCards.some(
          (card) => {
            const token = tokens.get(card.id)
            return token === undefined || !isCurrentCardOperation(card.id, token)
          },
        )
      ) {
        generatedUrls.forEach(URL.revokeObjectURL)
        return
      }

      replaceCards(nextCards)
      releaseUnusedUrls(
        plan.cardsToUpdate.flatMap((card) => [
          card.backSrc,
          card.backProcessedSrc,
        ].filter((url): url is string => url !== undefined)),
        nextCards,
      )
      setErrors((current) => ({ ...current, back: undefined }))
    } catch {
      generatedUrls.forEach(URL.revokeObjectURL)
      setErrors((current) => ({
        ...current,
        back: 'Could not read the selected back image. Try again.',
      }))
    }
  }

  function handleProcessedImage(side: CardSide, blob: Blob) {
    if (starterDeckOperationInProgress.current) return
    const currentCard = cardsRef.current.find((card) => card.id === selectedId)
    if (!currentCard) return
    const sourceKey = side === 'front' ? 'frontSrc' : 'backSrc'
    const cropKey = side === 'front' ? 'frontCrop' : 'backCrop'
    const processedKey = side === 'front' ? 'frontProcessedSrc' : 'backProcessedSrc'
    if (!currentCard[sourceKey] || !currentCard[cropKey]) return

    const nextProcessedUrl = URL.createObjectURL(blob)
    const nextCard = { ...currentCard, [processedKey]: nextProcessedUrl }
    const nextCards = cardsRef.current.map((card) =>
      card.id === currentCard.id ? nextCard : card,
    )
    replaceCards(nextCards)
    releaseUnusedUrls(
      currentCard[processedKey] ? [currentCard[processedKey]] : [],
      nextCards,
    )
  }

  function handleError(side: CardSide, message: string | undefined) {
    setErrors((current) => ({ ...current, [side]: message }))
  }

  return {
    cards,
    cardsRef,
    selectedId,
    setSelectedId,
    errors,
    setErrors,
    replaceCards,
    releaseUnusedUrls,
    beginCardOperation,
    isCurrentCardOperation,
    updateCard,
    handleQuantityStep,
    handleAddCard,
    handleDuplicateCard,
    handleDeleteCard,
    handleImageSelect,
    handleImageRemove,
    handleCropChange,
    handleUseBackForEveryCard,
    handleProcessedImage,
    handleError,
  }
}
