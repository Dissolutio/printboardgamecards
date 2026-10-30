import { describe, expect, it } from 'vitest'
import {
  createTranslator,
  listPlaceholders,
  type Catalog,
} from './messages.ts'

describe('createTranslator', () => {
  it('formats numeric parameters with the requested locale', () => {
    const catalog: Catalog = { value: 'Value: {value}' }
    expect(createTranslator(catalog, 'en-US')('value', { value: 1234.5 })).toBe(
      'Value: 1,234.5',
    )
    expect(createTranslator(catalog, 'de-DE')('value', { value: 1234.5 })).toBe(
      'Value: 1.234,5',
    )
    expect(createTranslator(catalog, 'de-DE')('value', { value: '1234.5' })).toBe(
      'Value: 1234.5',
    )
  })

  it('selects plural categories for English, Arabic, and Russian', () => {
    const catalog: Catalog = {
      count: {
        zero: 'zero',
        one: 'one',
        two: 'two',
        few: 'few',
        many: 'many',
        other: 'other',
      },
    }
    const english = createTranslator(catalog, 'en')
    const arabic = createTranslator(catalog, 'ar')
    const russian = createTranslator(catalog, 'ru')

    expect(english('count', { count: 1 })).toBe('one')
    expect(english('count', { count: 2 })).toBe('other')
    expect(arabic('count', { count: 0 })).toBe('zero')
    expect(arabic('count', { count: 1 })).toBe('one')
    expect(arabic('count', { count: 2 })).toBe('two')
    expect(arabic('count', { count: 3 })).toBe('few')
    expect(arabic('count', { count: 11 })).toBe('many')
    expect(arabic('count', { count: 100 })).toBe('other')
    expect(russian('count', { count: 1 })).toBe('one')
    expect(russian('count', { count: 2 })).toBe('few')
    expect(russian('count', { count: 5 })).toBe('many')
    expect(russian('count', { count: 1.5 })).toBe('other')
  })

  it('uses the fallback catalog and returns an unknown key unchanged', () => {
    const translate = createTranslator({ present: 'Main' }, 'en', {
      fallback: 'Fallback',
    })
    expect(translate('fallback')).toBe('Fallback')
    expect(translate('missing')).toBe('missing')
  })

  it('keeps missing placeholders visible and reports them without throwing', () => {
    const problems: string[] = []
    const translate = createTranslator(
      { greeting: 'Hello, {name}.' },
      'en',
      undefined,
      (problem) => problems.push(problem),
    )
    expect(translate('greeting')).toBe('Hello, {name}.')
    expect(problems).toEqual(['Missing value for placeholder {name} in message "greeting".'])

    const throwingCallback = createTranslator(
      { greeting: 'Hello, {name}.' },
      'en',
      undefined,
      () => {
        throw new Error('diagnostic failure')
      },
    )
    expect(() => throwingCallback('greeting')).not.toThrow()
  })
})

describe('listPlaceholders', () => {
  it('returns unique placeholder names in sorted order', () => {
    expect(listPlaceholders('{z} {a} {z}')).toEqual(['a', 'z'])
    expect(
      listPlaceholders({
        one: '{count} copy',
        other: '{count} copies for {name}',
      }),
    ).toEqual(['count', 'name'])
  })
})
