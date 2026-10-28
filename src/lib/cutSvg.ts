import { DEFAULT_BLEED, type Size } from './geometry.ts'
import type { Grid } from './layout.ts'

export function buildCutSvg({
  paper,
  grid,
  cardSize,
  count,
  cornerRadiusPt = 0,
}: {
  paper: Size
  grid: Grid
  cardSize: Size
  count: number
  cornerRadiusPt?: number
}): string {
  const capacity = Math.max(0, grid.cols) * Math.max(0, grid.rows)
  const pathCount = Number.isNaN(count)
    ? 0
    : Math.max(0, Math.min(capacity, Math.trunc(count)))
  const radius = Number.isNaN(cornerRadiusPt)
    ? 0
    : Math.max(0, Math.min(cornerRadiusPt, cardSize.width / 2, cardSize.height / 2))
  const paths = Array.from({ length: pathCount }, (_, index) => {
    const col = index % grid.cols
    const row = Math.floor(index / grid.cols)
    const x = grid.originX + col * grid.cellW + DEFAULT_BLEED
    const y = grid.originY + row * grid.cellH + DEFAULT_BLEED
    const right = x + cardSize.width
    const bottom = y + cardSize.height
    const format = (value: number) => value.toFixed(2)
    const d =
      radius === 0
        ? `M ${format(x)} ${format(y)} L ${format(right)} ${format(y)} L ${format(right)} ${format(bottom)} L ${format(x)} ${format(bottom)} Z`
        : `M ${format(x + radius)} ${format(y)} L ${format(right - radius)} ${format(y)} A ${format(radius)} ${format(radius)} 0 0 1 ${format(right)} ${format(y + radius)} L ${format(right)} ${format(bottom - radius)} A ${format(radius)} ${format(radius)} 0 0 1 ${format(right - radius)} ${format(bottom)} L ${format(x + radius)} ${format(bottom)} A ${format(radius)} ${format(radius)} 0 0 1 ${format(x)} ${format(bottom - radius)} L ${format(x)} ${format(y + radius)} A ${format(radius)} ${format(radius)} 0 0 1 ${format(x + radius)} ${format(y)} Z`

    return `<path d="${d}" fill="none" stroke="#FF0000" stroke-width="1"/>`
  }).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${(paper.width / 72).toFixed(4)}in" height="${(paper.height / 72).toFixed(4)}in" viewBox="0 0 ${paper.width} ${paper.height}"><g id="cut-lines" fill="none">${paths}</g></svg>`
}
