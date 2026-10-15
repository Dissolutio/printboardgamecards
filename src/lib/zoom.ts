export const ZOOM_STEP = 0.1
export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 10

export function clampZoom(
  value: number,
  min = MIN_ZOOM,
  max = MAX_ZOOM,
): number {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    min > max
  ) {
    throw new RangeError('Zoom and zoom bounds must be finite, with min <= max.')
  }

  const bounded = Math.min(max, Math.max(min, value))
  const rounded = Number((Math.round(bounded / ZOOM_STEP) * ZOOM_STEP).toFixed(1))
  return Math.min(max, Math.max(min, rounded))
}

export function parseZoomInput(
  input: string,
  min = MIN_ZOOM,
  max = MAX_ZOOM,
): number | undefined {
  const normalizedInput = input.trim()
  if (!normalizedInput) return undefined

  const value = Number(normalizedInput)
  return Number.isFinite(value) ? clampZoom(value, min, max) : undefined
}
