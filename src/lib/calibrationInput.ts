export function parseMeasurement(input: string): number | undefined {
  const trimmed = input.trim()
  if (trimmed === '') return undefined

  const measurement = Number(trimmed)
  return Number.isFinite(measurement) ? measurement : undefined
}
