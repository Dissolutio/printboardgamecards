import { formatNumber } from '../i18n/numbers.ts'
import type { Card } from '../types.ts'
import type { PieceOrientation, PAPER } from './geometry.ts'
import { summarizePrint } from './printSummary.ts'

export type AppScreen = 'start' | 'workspace'
export type StartExportMode = 'PRINT_GLUE' | 'DUPLEX'

export function chooseScreen(cards: Card[], projectOpened = false): AppScreen {
  if (
    projectOpened ||
    cards.some(
      (card) =>
        card.frontSrc ||
        card.backSrc ||
        card.frontProcessedSrc ||
        card.backProcessedSrc,
    )
  ) {
    return 'workspace'
  }
  return 'start'
}

export function summarizeStartDeck({
  cardCount,
  presetName,
  paperName,
  exportMode,
  pieceOrientation,
  locale = 'en',
}: {
  cardCount: number
  presetName: string
  paperName: keyof typeof PAPER
  exportMode: StartExportMode
  pieceOrientation: PieceOrientation
  locale?: string
}) {
  const summary = summarizePrint({
    cards: [
      {
        id: 'start-summary',
        frontProcessedSrc: 'start-summary-front',
        frontCrop: { x: 0, y: 0, width: 1, height: 1 },
        backProcessedSrc: 'start-summary-back',
        backCrop: { x: 0, y: 0, width: 1, height: 1 },
        bleedMode: 'IMAGE',
        frontBackground: { enabled: false, color: '#ffffff' },
        backBackground: { enabled: false, color: '#ffffff' },
        bleedColor: '#ffffff',
        quantity: cardCount,
      },
    ],
    presetName,
    paperName,
    pieceOrientation,
    mode: exportMode === 'PRINT_GLUE' ? 'ONE_SIDE_GLUE' : 'TWO_SIDES_HAND',
  })
  const number = (value: number) => formatNumber(value, locale)
  const cardLabel = cardCount === 1 ? 'card' : 'cards'
  const pageLabel = summary.pages === 1 ? 'page' : 'pages'
  const paperLabel = paperName === 'LETTER' ? 'Letter' : 'A4'
  const piecesText =
    exportMode === 'PRINT_GLUE'
      ? `${number(cardCount * 2)} card sides. `
      : ''
  const perPageLabel = exportMode === 'PRINT_GLUE' ? 'card sides' : 'cards'

  return {
    ...summary,
    text: `${number(cardCount)} ${cardLabel}. ${piecesText}${number(summary.pages)} ${pageLabel} on ${paperLabel}. ${number(summary.cardsPerPage)} ${perPageLabel} per page.`,
  }
}
