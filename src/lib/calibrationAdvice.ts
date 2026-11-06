import type { PrintMode } from './printSummary.ts'

export const HAND_CUT_SKIP_LIMIT_MM = 1.0
export const MACHINE_CUT_SKIP_LIMIT_MM = 0.3

type CalibrationAdviceInput = {
  observedXmm: number | string | undefined
  observedYmm: number | string | undefined
  cutting: PrintMode
}

type CalibrationAdvice = {
  kind: 'SKIP' | 'APPLY'
  worstMm: number
}

function parseReading(value: number | string | undefined): number | undefined {
  if (typeof value === 'string' && value.trim() === '') return undefined

  const reading = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(reading) ? reading : undefined
}

export function calibrationAdvice({
  observedXmm,
  observedYmm,
  cutting,
}: CalibrationAdviceInput): CalibrationAdvice | undefined {
  const x = parseReading(observedXmm)
  const y = parseReading(observedYmm)
  if (x === undefined || y === undefined) return undefined

  const worstMm = Math.max(Math.abs(x), Math.abs(y))
  const limit =
    cutting === 'TWO_SIDES_MACHINE'
      ? MACHINE_CUT_SKIP_LIMIT_MM
      : HAND_CUT_SKIP_LIMIT_MM

  return { kind: worstMm <= limit ? 'SKIP' : 'APPLY', worstMm }
}
