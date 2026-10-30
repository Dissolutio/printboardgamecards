const formatCache = new Map<string, Intl.NumberFormat>()
const FORMAT_CACHE_LIMIT = 32

function stableOptionsKey(options: Intl.NumberFormatOptions = {}): string {
  return Object.entries(options)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${String(value)}`)
    .join(',')
}

function getNumberFormat(
  locale: string,
  options: Intl.NumberFormatOptions = {},
): Intl.NumberFormat {
  const key = `${locale}|${stableOptionsKey(options)}`
  const cached = formatCache.get(key)
  if (cached) return cached

  const formatter = new Intl.NumberFormat(locale, options)
  formatCache.set(key, formatter)
  if (formatCache.size > FORMAT_CACHE_LIMIT) {
    const oldestKey = formatCache.keys().next().value
    if (oldestKey !== undefined) formatCache.delete(oldestKey)
  }
  return formatter
}

function localeNumberSymbols(locale: string): {
  decimal: string
  group: string | undefined
  primaryGroupSize: number
  secondaryGroupSize: number
  digits: Map<string, string>
} {
  const formatter = new Intl.NumberFormat(locale)
  const parts = formatter.formatToParts(1234567890123.5)
  const decimal = parts.find((part) => part.type === 'decimal')?.value ?? '.'
  const group = parts.find((part) => part.type === 'group')?.value
  const integerGroups = parts
    .filter((part) => part.type === 'integer')
    .map((part) => part.value)
  const primaryGroupSize = integerGroups.at(-1)?.length ?? 3
  const secondaryGroupSize =
    integerGroups.length > 2
      ? integerGroups.at(-2)?.length ?? primaryGroupSize
      : primaryGroupSize
  const digitFormatter = new Intl.NumberFormat(locale, {
    useGrouping: false,
    maximumFractionDigits: 0,
  })
  const digits = new Map<string, string>()
  for (let digit = 0; digit <= 9; digit += 1) {
    digits.set(digitFormatter.format(digit), String(digit))
  }
  const minusSign =
    new Intl.NumberFormat(locale, { signDisplay: 'always' })
      .formatToParts(-1)
      .find((part) => part.type === 'minusSign')?.value ?? '-'
  if (minusSign !== '-') digits.set(minusSign, '-')
  return { decimal, group, primaryGroupSize, secondaryGroupSize, digits }
}

function validateGroupedInteger(
  integer: string,
  group: string | undefined,
  primaryGroupSize: number,
  secondaryGroupSize: number,
): string | undefined {
  if (!group || !integer.includes(group)) return /^\d*$/.test(integer) ? integer : undefined
  const groups = integer.split(group)
  if (groups.some((part) => part === '' || !/^\d+$/.test(part))) return undefined

  const last = groups.at(-1)
  if (last === undefined || last.length !== primaryGroupSize) return undefined
  for (let index = groups.length - 2; index > 0; index -= 1) {
    if (groups[index]?.length !== secondaryGroupSize) return undefined
  }
  const first = groups[0]
  if (first === undefined || first.length < 1 || first.length > secondaryGroupSize) {
    return undefined
  }
  return groups.join('')
}

/**
 * A period is an alternate decimal only when it is not the locale grouping separator.
 * A grouping period must form valid groups, so de-DE accepts 1.500 as 1500, not 1.5.
 */
export function parseLocaleNumber(input: string, locale: string): number | undefined {
  const trimmed = input.trim()
  if (trimmed === '') return undefined

  const symbols = localeNumberSymbols(locale)
  let normalized = trimmed
  for (const [localizedDigit, asciiDigit] of [...symbols.digits].sort(
    ([left], [right]) => right.length - left.length,
  )) {
    normalized = normalized.replaceAll(localizedDigit, asciiDigit)
  }
  if (symbols.group && /[\u00a0\u202f\u2009 ]/.test(symbols.group)) {
    normalized = normalized.replace(/[\u00a0\u202f\u2009 ]/g, symbols.group)
  }
  normalized = normalized.replaceAll('\u2212', '-')

  let sign = ''
  if (normalized.startsWith('-') || normalized.startsWith('+')) {
    sign = normalized[0] ?? ''
    normalized = normalized.slice(1)
  }
  if (normalized.includes('+') || normalized.includes('-')) return undefined

  const alternateDecimal =
    symbols.decimal !== '.' && symbols.group !== '.' ? '.' : undefined
  const decimalMarks = [symbols.decimal, alternateDecimal].filter(
    (mark): mark is string => mark !== undefined,
  )
  const foundDecimalMarks = decimalMarks.filter((mark) => normalized.includes(mark))
  if (foundDecimalMarks.length > 1) return undefined
  const decimalMark = foundDecimalMarks[0]
  let integer = normalized
  let fraction = ''
  if (decimalMark !== undefined) {
    const splitIndex = normalized.indexOf(decimalMark)
    if (normalized.indexOf(decimalMark, splitIndex + decimalMark.length) !== -1) {
      return undefined
    }
    integer = normalized.slice(0, splitIndex)
    fraction = normalized.slice(splitIndex + decimalMark.length)
    if (fraction === '' || !/^\d+$/.test(fraction)) return undefined
  }
  if (symbols.group && fraction.includes(symbols.group)) return undefined

  const ungroupedInteger = validateGroupedInteger(
    integer,
    symbols.group,
    symbols.primaryGroupSize,
    symbols.secondaryGroupSize,
  )
  if (ungroupedInteger === undefined) return undefined
  if (ungroupedInteger === '' && fraction === '') return undefined

  const value = Number(`${sign}${ungroupedInteger || '0'}${decimalMark ? `.${fraction}` : ''}`)
  return Number.isFinite(value) ? value : undefined
}

export function formatNumber(
  value: number,
  locale: string,
  options?: Intl.NumberFormatOptions,
): string {
  return getNumberFormat(locale, options).format(value)
}

export function formatPercent(
  ratio: number,
  locale: string,
  fractionDigits = 0,
): string {
  return getNumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(ratio)
}
