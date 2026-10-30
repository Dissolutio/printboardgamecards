import { describe, expect, it } from 'vitest'
import {
  formatNumber,
  formatPercent,
  parseLocaleNumber,
} from './numbers.ts'

describe('parseLocaleNumber', () => {
  it.each([
    ['', 'en-US', undefined],
    ['   ', 'en-US', undefined],
    ['1e2', 'en-US', undefined],
    ['NaN', 'en-US', undefined],
    ['Infinity', 'en-US', undefined],
    ['1.2.3', 'en-US', undefined],
    ['1,23', 'en-US', undefined],
    ['1,234.5', 'en-US', 1234.5],
    [' -1,234.5 ', 'en-US', -1234.5],
    ['+12.5', 'en-US', 12.5],
    ['−12.5', 'en-US', -12.5],
    ['1,5', 'de-DE', 1.5],
    ['1.5', 'de-DE', undefined],
    ['1.500', 'de-DE', 1500],
    ['1.234,5', 'de-DE', 1234.5],
  ])('parses %j for %s as %j', (input, locale, expected) => {
    expect(parseLocaleNumber(input, locale)).toBe(expected)
  })

  it('accepts a no-break space group and Arabic-Indic digits', () => {
    expect(parseLocaleNumber('1\u00a0234,5', 'fr-FR')).toBe(1234.5)
    expect(parseLocaleNumber('1.5', 'fr-FR')).toBe(1.5)
    const arabic = new Intl.NumberFormat('ar-EG').format(1234.5)
    expect(parseLocaleNumber(arabic, 'ar-EG')).toBe(1234.5)
  })
})

describe('number formatting', () => {
  it('formats values and percentages with the requested locale', () => {
    expect(formatNumber(1234.5, 'en-US')).toBe('1,234.5')
    expect(formatNumber(1234.5, 'de-DE')).toBe('1.234,5')
    expect(formatNumber(1234.5, 'fr-FR')).toContain('234,5')
    expect(formatPercent(1, 'en-US')).toBe('100%')
    expect(formatPercent(0.995, 'de-DE', 1).replace(/\s/gu, '')).toBe('99,5%')
  })
})
