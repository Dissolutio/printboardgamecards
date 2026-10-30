import {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type SetStateAction,
} from 'react'
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
import {
  canRedo as historyCanRedo,
  canUndo as historyCanUndo,
  commit as commitHistory,
  createHistory,
  redo as redoHistory,
  replacePresent,
  retainedUrls,
  undo as undoHistory,
  type History,
  type HistorySettings,
} from '../lib/history.ts'
import type { Card, CardSide, PixelCropRect } from '../types.ts'

type PresetName = keyof typeof CARD_PRESETS
type QuantityDirection = -1 | 1
export type ReplaceCardsOptions = {
  settings?: HistorySettings
  history?: 'commit' | 'replacePresent' | 'none'
  label?: string
  coalesceKey?: string
}

function revokeUnusedUrls(
  candidates: string[],
  remainingCards: Card[],
  history: History,
) {
  const retained = new Set([
    ...remainingCards.flatMap(objectUrls),
    ...retainedUrls(history),
  ])
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
  settings,
  restoreSettings,
  isHistoryBusy,
  showUndoToast,
}: {
  appliedPreset: MutableRefObject<PresetName>
  presetInProgress: MutableRefObject<boolean>
  projectOperationInProgress: MutableRefObject<boolean>
  starterDeckOperationInProgress: MutableRefObject<boolean>
  isExporting: boolean
  settings: HistorySettings
  restoreSettings: (settings: HistorySettings) => void
  isHistoryBusy: () => boolean
  showUndoToast: (
    key:
      | 'undo.toast.cardDeleted'
      | 'undo.toast.imageRemoved'
      | 'undo.toast.backsReplaced',
    params?: { count: number },
  ) => void
}) {
  const [cards, setCards] = useState<Card[]>(() => [createCard('card-1')])
  const cardsRef = useRef(cards)
  const cardOperationTokens = useRef(new Map<string, number>())
  const [selectedId, setSelectedIdState] = useState('card-1')
  const selectedIdRef = useRef(selectedId)
  const [history, setHistory] = useState(() =>
    createHistory({ cards, settings }),
  )
  const historyRef = useRef(history)
  const settingsRef = useRef(settings)
  const beforeSelectionBySnapshot = useRef(
    new WeakMap<History['present'], string>(),
  )
  const afterSelectionBySnapshot = useRef(
    new WeakMap<History['present'], string>(),
  )
  afterSelectionBySnapshot.current.set(history.present, selectedId)
  const [errors, setErrors] = useState<Record<CardSide, string | undefined>>({
    front: undefined,
    back: undefined,
  })

  settingsRef.current = settings

  useEffect(
    () => () => {
      const urls = new Set([
        ...cardsRef.current.flatMap(objectUrls),
        ...retainedUrls(historyRef.current),
      ])
      for (const url of urls) {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url)
      }
    },
    [],
  )

  function setSelectedId(value: SetStateAction<string>) {
    const nextId =
      typeof value === 'function' ? value(selectedIdRef.current) : value
    selectedIdRef.current = nextId
    setSelectedIdState(nextId)
    afterSelectionBySnapshot.current.set(historyRef.current.present, nextId)
  }

  function releaseDroppedHistoryUrls(previous: History, next: History, nextCards: Card[]) {
    const retained = new Set([
      ...nextCards.flatMap(objectUrls),
      ...retainedUrls(next),
    ])
    for (const url of retainedUrls(previous)) {
      if (url.startsWith('blob:') && !retained.has(url)) URL.revokeObjectURL(url)
    }
  }

  function updateHistory(nextHistory: History, nextCards: Card[]) {
    const previousHistory = historyRef.current
    historyRef.current = nextHistory
    setHistory(nextHistory)
    releaseDroppedHistoryUrls(previousHistory, nextHistory, nextCards)
  }

  function replaceCards(
    nextCards: Card[],
    options: ReplaceCardsOptions = {},
  ) {
    const nextSettings = options.settings ?? settingsRef.current
    const snapshot = { cards: nextCards, settings: nextSettings }
    if (options.history === 'replacePresent') {
      const previousHistory = historyRef.current
      const nextHistory = replacePresent(previousHistory, snapshot)
      if (nextHistory.present !== previousHistory.present) {
        beforeSelectionBySnapshot.current.set(
          nextHistory.present,
          beforeSelectionBySnapshot.current.get(previousHistory.present) ??
            selectedIdRef.current,
        )
        afterSelectionBySnapshot.current.set(
          nextHistory.present,
          afterSelectionBySnapshot.current.get(previousHistory.present) ??
            selectedIdRef.current,
        )
      }
      updateHistory(nextHistory, nextCards)
    } else if (options.history !== 'none') {
      const previousHistory = historyRef.current
      const now = Date.now()
      const nextHistory = commitHistory(previousHistory, snapshot, {
        label: options.label,
        coalesceKey: options.coalesceKey,
        now,
      })
      if (nextHistory !== previousHistory) {
        const coalesces =
          options.coalesceKey !== undefined &&
          options.coalesceKey === previousHistory.lastCommit?.coalesceKey &&
          now >= previousHistory.lastCommit.now &&
          now - previousHistory.lastCommit.now <= 800
        beforeSelectionBySnapshot.current.set(
          nextHistory.present,
          coalesces
            ? beforeSelectionBySnapshot.current.get(previousHistory.present) ??
                selectedIdRef.current
            : selectedIdRef.current,
        )
        afterSelectionBySnapshot.current.set(
          nextHistory.present,
          selectedIdRef.current,
        )
        updateHistory(nextHistory, nextCards)
      }
    }
    settingsRef.current = nextSettings
    cardsRef.current = nextCards
    setCards(nextCards)
  }

  function releaseUnusedUrls(candidates: string[], remainingCards: Card[]) {
    revokeUnusedUrls(candidates, remainingCards, historyRef.current)
  }

  function commitSettings(nextSettings: Partial<HistorySettings>) {
    const updatedSettings = { ...settingsRef.current, ...nextSettings }
    replaceCards(cardsRef.current, { settings: updatedSettings })
    return updatedSettings
  }

  function restoreHistory(direction: 'undo' | 'redo') {
    if (isHistoryBusy()) return
    const previousHistory = historyRef.current
    const nextHistory =
      direction === 'undo'
        ? undoHistory(previousHistory)
        : redoHistory(previousHistory)
    if (nextHistory === previousHistory) return

    const selected =
      direction === 'undo'
        ? beforeSelectionBySnapshot.current.get(previousHistory.present)
        : afterSelectionBySnapshot.current.get(nextHistory.present)
    cardsRef.current = nextHistory.present.cards
    setCards(nextHistory.present.cards)
    settingsRef.current = nextHistory.present.settings
    updateHistory(nextHistory, nextHistory.present.cards)
    restoreSettings(nextHistory.present.settings)
    setSelectedId(selected ?? selectedIdRef.current)
    setErrors({ front: undefined, back: undefined })
  }

  function updateCard(nextCard: Card) {
    if (starterDeckOperationInProgress.current) return
    const currentCards = cardsRef.current
    const currentCard = currentCards.find((card) => card.id === nextCard.id)
    const nextCards = currentCards.map((card) => (card.id === nextCard.id ? nextCard : card))
    let coalesceKey: string | undefined
    if (currentCard?.quantity !== nextCard.quantity) {
      coalesceKey = `${nextCard.id}:quantity`
    } else if (currentCard?.bleedColor !== nextCard.bleedColor) {
      coalesceKey = `${nextCard.id}:bleedColor`
    } else {
      for (const side of ['front', 'back'] as const) {
        const backgroundKey = side === 'front' ? 'frontBackground' : 'backBackground'
        if (currentCard?.[backgroundKey].color !== nextCard[backgroundKey].color) {
          coalesceKey = `${nextCard.id}:${side}Background.color`
          break
        }
      }
    }
    replaceCards(nextCards, { coalesceKey })
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
    replaceCards(nextCards, { label: 'cardDeleted' })
    if (removedCard) showUndoToast('undo.toast.cardDeleted')
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
    replaceCards(nextCards, { label: 'imageRemoved' })
    showUndoToast('undo.toast.imageRemoved')
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
    replaceCards(nextCards, {
      coalesceKey: `${currentCard.id}:${side}Crop`,
    })
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

      replaceCards(nextCards, {
        label: 'backsReplaced',
      })
      showUndoToast('undo.toast.backsReplaced', {
        count: plan.cardsToUpdate.length,
      })
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
    replaceCards(nextCards, { history: 'replacePresent' })
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
    commitSettings,
    undo: () => restoreHistory('undo'),
    redo: () => restoreHistory('redo'),
    canUndo: historyCanUndo(history),
    canRedo: historyCanRedo(history),
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
