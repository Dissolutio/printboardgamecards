import { describe, expect, it } from 'vitest'
import {
  checkCatalog,
  checkMessage,
  checkPluralCompleteness,
} from './copyRules.ts'
import type { Catalog } from './messages.ts'

describe('checkMessage', () => {
  it.each([
    ["don't", 'contraction'],
    ['e.g. this', 'abbreviation'],
    ['copy(s)', 'plural-marker'],
    ['Front · back', 'middle-dot'],
    ['Move → right', 'arrow'],
    ['negative = left', 'equals-sign'],
    [
      'Measure the printer output carefully before you enter the values because this sentence contains many more words than the permitted limit and should be flagged by the checker.',
      'sentence-length',
    ],
    ['The printer is ready; the paper is loaded.', 'semicolon'],
    ['PRINT THE PAGE', 'uppercase-emphasis'],
    ['This piece is blank.', 'preferred-term'],
  ])('flags %s for %s', (text, rule) => {
    expect(checkMessage(text).map((problem) => problem.rule)).toContain(rule)
  })

  it('does not flag clean messages or placeholders', () => {
    expect(
      checkMessage('Print the card at {scale}. Use a PDF file. Measure the offset.'),
    ).toEqual([])
  })
})

describe('catalog checks', () => {
  it('reports all problematic messages and incomplete plural forms', () => {
    const catalog: Catalog = {
      bad: 'Keep this piece.',
      copies: { one: '{count} copy', other: '{count} copies' },
      complete: {
        zero: 'zero',
        one: 'one',
        two: 'two',
        few: 'few',
        many: 'many',
        other: 'other',
      },
    }
    expect(checkCatalog(catalog).map(({ key }) => key)).toEqual(['bad'])
    expect(checkPluralCompleteness(catalog, 'en')).toEqual([])
    expect(checkPluralCompleteness(catalog, 'ar')).toEqual(['copies'])
  })
})
