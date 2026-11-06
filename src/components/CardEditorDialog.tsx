import { useRef, useState, type KeyboardEvent } from 'react'
import CardEditor from './CardEditor.tsx'
import { Dialog } from './Dialog.tsx'
import QuantityStepper from './QuantityStepper.tsx'
import { createTranslator } from '../i18n/messages.ts'
import { en } from '../i18n/en.ts'
import type { Size } from '../lib/geometry.ts'
import type { BleedMode, Card, CardSide } from '../types.ts'
import type { useCards } from '../hooks/useCards.ts'

const translate = createTranslator(en, 'en')

export function BackUsePanel({
  card,
  count,
  disabled,
  onUse,
}: {
  card: Card
  count: number
  disabled: boolean
  onUse: () => void
}) {
  return (
    <section className="space-y-3 rounded-xl border border-[#2c3547] bg-[#1f2633] p-4">
      {count > 1 && (
        <p className="text-sm">
          {translate('cardEditor.back.count', { count })}
        </p>
      )}
      <button
        className="btn btn-primary min-h-11 w-full"
        type="button"
        disabled={disabled || !card.backSrc || !card.backCrop || count < 1}
        onClick={onUse}
      >
        {translate('cardEditor.back.useForEveryCard')}
      </button>
      <p className="text-sm text-[#a3adc2]">
        {translate('cardEditor.back.hint')}
      </p>
    </section>
  )
}

type CardEditorDialogProps = {
  open: boolean
  onClose: () => void
  cardState: ReturnType<typeof useCards>
  cardSize: Size
  disabled: boolean
  onSelect: (cardId: string) => void
  onBleedModeChange: (cardId: string, mode: BleedMode) => void
  onDelete: (cardId: string) => void
}

export default function CardEditorDialog({
  open,
  onClose,
  cardState,
  cardSize,
  disabled,
  onSelect,
  onBleedModeChange,
  onDelete,
}: CardEditorDialogProps) {
  const {
    cards,
    selectedId,
    errors,
    handleQuantityStep,
    updateCard,
    handleImageSelect,
    handleImageRemove,
    handleCropChange,
    handleProcessedImage,
    handleError,
    handleDuplicateCard,
    handleUseBackForEveryCard,
  } = cardState
  const [tabState, setTabState] = useState<{ open: boolean; side: CardSide }>({
    open,
    side: 'front',
  })
  if (tabState.open !== open) {
    setTabState({ open, side: open ? 'front' : tabState.side })
  }
  const side = tabState.side
  const tabRefs = useRef<Record<CardSide, HTMLButtonElement | null>>({
    front: null,
    back: null,
  })
  const cardIndex = cards.findIndex((card) => card.id === selectedId)
  const card = cards[cardIndex]
  const backSourceCount = card?.backSrc
    ? cards.filter((item) => item.backSrc === card.backSrc).length
    : 0

  function moveTab(nextSide: CardSide) {
    setTabState((current) => ({ ...current, side: nextSide }))
    tabRefs.current[nextSide]?.focus()
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      moveTab(
        event.key === 'ArrowRight'
          ? side === 'front'
            ? 'back'
            : 'front'
          : side === 'back'
            ? 'front'
            : 'back',
      )
    }
  }

  if (!card || cardIndex < 0) return null

  const cardPosition = cardIndex + 1
  const title = translate('cardEditor.header.title', { number: cardPosition })
  const backPanel =
    side === 'back' ? (
      <BackUsePanel
        card={card}
        count={backSourceCount}
        disabled={disabled}
        onUse={() => void handleUseBackForEveryCard()}
      />
    ) : undefined

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      fullScreenOnPhone
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="btn btn-outline min-h-11"
            type="button"
            disabled={disabled}
            onClick={() => handleDuplicateCard(card.id)}
          >
            {translate('cardEditor.footer.duplicate')}
          </button>
          <button
            className="btn min-h-11 border bg-transparent"
            style={{ color: '#ff7aa2', borderColor: '#5b2a3d' }}
            type="button"
            disabled={disabled}
            onClick={() => onDelete(card.id)}
          >
            {translate('cardEditor.footer.delete')}
          </button>
          <span className="flex-1" />
          <span className="text-sm text-[#a3adc2]">
            {translate('cardEditor.footer.saveNote')}
          </span>
          <button
            className="btn btn-primary min-h-11 px-6"
            type="button"
            onClick={onClose}
          >
            {translate('cardEditor.footer.done')}
          </button>
        </div>
      }
    >
      <div className="sticky top-0 z-20 -mx-5 -mt-5 bg-[#181e29]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#2c3547] px-4 py-3">
          <button
            className="btn min-h-11 w-11 border border-[#2c3547] bg-[#1f2633] p-0"
            type="button"
            aria-label={translate('cardEditor.navigation.previous')}
            disabled={disabled || cardIndex === 0}
            onClick={() => onSelect(cards[cardIndex - 1]!.id)}
          >
            ‹
          </button>
          <span className="flex-1 whitespace-nowrap text-sm text-[#a3adc2]">
            {translate('cardEditor.header.position', {
              current: cardPosition,
              total: cards.length,
            })}
          </span>
          <button
            className="btn min-h-11 w-11 border border-[#2c3547] bg-[#1f2633] p-0"
            type="button"
            aria-label={translate('cardEditor.navigation.next')}
            disabled={disabled || cardIndex === cards.length - 1}
            onClick={() => onSelect(cards[cardIndex + 1]!.id)}
          >
            ›
          </button>
          <span className="ml-auto text-sm text-[#a3adc2]">
            {translate('cardEditor.copies')}
          </span>
          <QuantityStepper
            quantity={card.quantity}
            cardLabel={title}
            disabled={disabled}
            decreaseLabel={translate('cardEditor.copies.fewer')}
            increaseLabel={translate('cardEditor.copies.more')}
            onStep={(direction) => handleQuantityStep(card.id, direction)}
          />
          <button
            className="btn min-h-11 w-11 border border-[#2c3547] bg-transparent p-0 text-xl"
            type="button"
            aria-label={translate('cardEditor.close')}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div
          className="flex gap-2 border-b border-[#2c3547] px-4"
          role="tablist"
          aria-label={translate('cardEditor.tabs.label')}
        >
          {(['front', 'back'] as const).map((tabSide) => (
            <button
              key={tabSide}
              ref={(element) => {
                tabRefs.current[tabSide] = element
              }}
              className={`min-h-11 border-b-[3px] px-5 ${
                side === tabSide
                  ? 'border-[#8f7bff] font-semibold text-[#e8ecf4]'
                  : 'border-transparent text-[#a3adc2]'
              }`}
              type="button"
              role="tab"
              id={`card-editor-tab-${tabSide}`}
              aria-selected={side === tabSide}
              aria-controls="card-editor-panel"
              tabIndex={side === tabSide ? 0 : -1}
              onClick={() =>
                setTabState((current) => ({ ...current, side: tabSide }))
              }
              onKeyDown={handleTabKeyDown}
            >
              {translate(tabSide === 'front' ? 'cardEditor.tabs.front' : 'cardEditor.tabs.back')}
            </button>
          ))}
        </div>
      </div>

      <div
        className="space-y-4 pt-4"
        role="tabpanel"
        id="card-editor-panel"
        aria-labelledby={`card-editor-tab-${side}`}
      >
        <CardEditor
          key={card.id}
          card={card}
          side={side}
          backPanel={backPanel}
          cardSize={cardSize}
          errors={errors}
          onCardChange={updateCard}
          onBleedModeChange={onBleedModeChange}
          onImageSelect={handleImageSelect}
          onImageRemove={handleImageRemove}
          onCropChange={handleCropChange}
          onProcessedImage={handleProcessedImage}
          onError={handleError}
        />
      </div>
    </Dialog>
  )
}
