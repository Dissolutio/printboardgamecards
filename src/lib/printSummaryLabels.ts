import { formatNumber } from '../i18n/numbers.ts'
import type { ModeSummary } from './printSummary.ts'

function countNoun(
  count: number,
  singular: string,
  plural: string,
  locale: string,
): string {
  const noun = new Intl.PluralRules(locale).select(count) === 'one' ? singular : plural
  return `${formatNumber(count, locale)} ${noun}`
}

export function printSummaryLabels(
  summary: ModeSummary,
  cardCount: number,
  locale: string,
) {
  const glue = summary.mode === 'ONE_SIDE_GLUE'
  const pagesOrSheets = glue ? summary.pages : summary.sheets
  const firstCount = formatNumber(summary.cardsPerPage, locale)
  const secondCount = formatNumber(pagesOrSheets, locale)
  const cardCountLabel = countNoun(cardCount, 'card', 'cards', locale)
  const pageNoun = glue ? 'page' : 'sheet'
  const pagePlural = glue ? 'pages' : 'sheets'
  const pageCountLabel = countNoun(pagesOrSheets, pageNoun, pagePlural, locale)
  const unit = glue ? 'pieces' : 'cards'

  return {
    firstCount,
    firstLabel: `${unit} per page`,
    secondCount,
    secondLabel: `${pageCountLabel} for ${cardCountLabel}`,
    modeLine:
      summary.mode === 'TWO_SIDES_MACHINE'
        ? `Includes marks and a cut file. ${firstCount} cards per page.`
        : `${firstCount} ${unit} per page. ${countNoun(
            pagesOrSheets,
            pageNoun,
            pagePlural,
            locale,
          )}.`,
  }
}
