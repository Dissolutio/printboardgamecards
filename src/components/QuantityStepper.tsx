import {
  quantityLabel,
} from '../lib/deck.ts'

type QuantityDirection = -1 | 1

type QuantityStepperProps = {
  quantity: number
  cardLabel: string
  decreaseLabel?: string
  increaseLabel?: string
  disabled?: boolean
  onStep: (direction: QuantityDirection) => void
}

export default function QuantityStepper({
  quantity,
  cardLabel,
  decreaseLabel,
  increaseLabel,
  disabled = false,
  onStep,
}: QuantityStepperProps) {
  return (
    <div className="join join-sm" role="group" aria-label={`${cardLabel} copy count`}>
      <button
        className="btn join-item h-11 min-h-11"
        type="button"
        disabled={disabled}
        aria-label={decreaseLabel ?? `Decrease ${cardLabel} copies`}
        title={decreaseLabel ?? `Decrease ${cardLabel} copies`}
        onClick={() => onStep(-1)}
      >
        −
      </button>
      <output
        className="join-item min-w-14 px-2 text-center text-xs"
        aria-label={quantityLabel(quantity)}
      >
        {quantityLabel(quantity)}
      </output>
      <button
        className="btn join-item h-11 min-h-11"
        type="button"
        disabled={disabled}
        aria-label={increaseLabel ?? `Increase ${cardLabel} copies`}
        title={increaseLabel ?? `Increase ${cardLabel} copies`}
        onClick={() => onStep(1)}
      >
        +
      </button>
    </div>
  )
}
