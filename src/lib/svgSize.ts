import type { Size } from './geometry.ts'

export function svgIntrinsicSize(svgText: string): Size | undefined {
  const root = svgText.match(/<(?:[\w.-]+:)?svg\b([^>]*)>/i)?.[1]
  if (root === undefined) return undefined

  const viewBox = root.match(
    /(?:^|\s)viewBox\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/,
  )
  const rawValue = viewBox?.[1] ?? viewBox?.[2] ?? viewBox?.[3]
  if (rawValue === undefined) return undefined

  const values = rawValue.trim().split(/[\s,]+/).map(Number)
  if (
    values.length !== 4 ||
    values.some((value) => !Number.isFinite(value)) ||
    values[2] <= 0 ||
    values[3] <= 0
  ) {
    return undefined
  }

  return { width: values[2], height: values[3] }
}
