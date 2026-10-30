import {
  quantityLabel,
} from '../lib/deck.ts'

type QuantityDirection = -1 | 1

type QuantityStepperProps = {
  quantity: number
  cardLabel: string
  disabled?: boolean
  onStep: (direction: QuantityDirection) => void
}

export default function QuantityStepper({
  quantity,
  cardLabel,
  disabled = false,
  onStep,
}: QuantityStepperProps) {
  return (
    <div className="join join-sm" role="group" aria-label={`${cardLabel} copy count`}>
      <button
        className="btn btn-xs join-item"
        type="button"
        disabled={disabled}
        aria-label={`Decrease ${cardLabel} copies`}
        title={`Decrease ${cardLabel} copies`}
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
        className="btn btn-xs join-item"
        type="button"
        disabled={disabled}
        aria-label={`Increase ${cardLabel} copies`}
        title={`Increase ${cardLabel} copies`}
        onClick={() => onStep(1)}
      >
        +
      </button>
    </div>
  )
}
