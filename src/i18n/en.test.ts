import { describe, expect, it } from 'vitest'
import { checkCatalog, checkPluralCompleteness } from './copyRules.ts'
import { en } from './en.ts'

describe('English message catalog', () => {
  it('has no copy-rule or English plural-completeness problems', () => {
    expect(checkCatalog(en)).toEqual([])
    expect(checkPluralCompleteness(en, 'en')).toEqual([])
  })

  it('includes the required plural message and empty-face labels', () => {
    expect(en['card.copyCount.output']).toEqual({
      one: '{count} copy',
      other: '{count} copies',
    })
    expect(en['cardFace.empty.front']).toBe('No front image')
    expect(en['cardFace.empty.back']).toBe('No back image')
  })
})
