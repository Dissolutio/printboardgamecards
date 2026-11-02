import { formatNumber } from '../i18n/numbers.ts'
import type { ModeSummary } from './printSummary.ts'

type EnglishPlural = 'one' | 'other'

function englishPlural(count: number, locale: string): EnglishPlural {
  return new Intl.PluralRules(locale).select(count) === 'one' ? 'one' : 'other'
}

function fillMessage(
  message: string,
  values: Record<string, string>,
): string {
  return message.replace(/\{([A-Za-z0-9_]+)\}/g, (placeholder, key: string) => {
    return values[key] ?? placeholder
  })
}

const secondLabelMessages = {
  glue: {
    one: {
      one: 'page for {cards} card',
      other: 'page for {cards} cards',
    },
    other: {
      one: 'pages for {cards} card',
      other: 'pages for {cards} cards',
    },
  },
  duplex: {
    one: {
      one: 'sheet for {cards} card',
      other: 'sheet for {cards} cards',
    },
    other: {
      one: 'sheets for {cards} card',
      other: 'sheets for {cards} cards',
    },
  },
} as const

const collectionMessages = {
  one: {
    one: '{cards} card, {copies} copy in total',
    other: '{cards} card, {copies} copies in total',
  },
  other: {
    one: '{cards} cards, {copies} copy in total',
    other: '{cards} cards, {copies} copies in total',
  },
} as const

const modeLineMessages = {
  glue: {
    one: '{perPage} pieces per page. {count} page.',
    other: '{perPage} pieces per page. {count} pages.',
  },
  duplex: {
    one: '{perPage} cards per page. {count} sheet.',
    other: '{perPage} cards per page. {count} sheets.',
  },
  machine: 'Includes marks and a cut file. {perPage} cards per page.',
} as const

export function printSummaryLabels(
  summary: ModeSummary,
  cardCount: number,
  locale: string,
) {
  const glue = summary.mode === 'ONE_SIDE_GLUE'
  const pagesOrSheets = glue ? summary.pages : summary.sheets
  const firstCount = formatNumber(summary.cardsPerPage, locale)
  const secondCount = formatNumber(pagesOrSheets, locale)
  const secondLabelMessage =
    secondLabelMessages[glue ? 'glue' : 'duplex'][
      englishPlural(pagesOrSheets, locale)
    ][englishPlural(cardCount, locale)]
  const modeLineMessage =
    summary.mode === 'TWO_SIDES_MACHINE'
      ? modeLineMessages.machine
      : modeLineMessages[glue ? 'glue' : 'duplex'][
          englishPlural(pagesOrSheets, locale)
        ]

  return {
    firstCount,
    firstLabel: glue ? 'pieces per page' : 'cards per page',
    secondCount,
    secondLabel: fillMessage(secondLabelMessage, {
      cards: formatNumber(cardCount, locale),
    }),
    modeLine: fillMessage(modeLineMessage, {
      perPage: firstCount,
      count: secondCount,
    }),
  }
}

export function cardCollectionLabel(
  cardCount: number,
  copyCount: number,
  locale: string,
): string {
  const message =
    collectionMessages[englishPlural(cardCount, locale)][
      englishPlural(copyCount, locale)
    ]
  return fillMessage(message, {
    cards: formatNumber(cardCount, locale),
    copies: formatNumber(copyCount, locale),
  })
}
