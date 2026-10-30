export type PluralMessage = Partial<Record<Intl.LDMLPluralRule, string>> & {
  other: string
}

export type Message = string | PluralMessage
export type Catalog = Record<string, Message>
export type MessageParams = Record<string, string | number>
export type ProblemCallback = (message: string) => void

const placeholderPattern = /\{([A-Za-z0-9_]+)\}/g

function isPluralMessage(message: Message): message is PluralMessage {
  return typeof message !== 'string'
}

function reportProblem(onProblem: ProblemCallback | undefined, message: string): void {
  try {
    onProblem?.(message)
  } catch {
    // A diagnostic callback must not prevent message rendering.
  }
}

export function createTranslator(
  catalog: Catalog,
  locale: string,
  fallback?: Catalog,
  onProblem?: ProblemCallback,
): (key: string, params?: MessageParams) => string {
  const numberFormat = new Intl.NumberFormat(locale)
  const pluralRules = new Intl.PluralRules(locale)

  return (key, params = {}) => {
    const message = catalog[key] ?? fallback?.[key]
    if (message === undefined) return key

    let text: string
    if (isPluralMessage(message)) {
      const count = params.count
      const category =
        typeof count === 'number' && Number.isFinite(count)
          ? pluralRules.select(count)
          : 'other'
      text = message[category] ?? message.other
    } else {
      text = message
    }

    return text.replace(placeholderPattern, (placeholder, name: string) => {
      const value = params[name]
      if (value === undefined) {
        reportProblem(onProblem, `Missing value for placeholder {${name}} in message "${key}".`)
        return placeholder
      }
      return typeof value === 'number' ? numberFormat.format(value) : value
    })
  }
}

export function listPlaceholders(message: Message): string[] {
  const texts = typeof message === 'string' ? [message] : Object.values(message)
  const placeholders = new Set<string>()
  for (const text of texts) {
    for (const match of text.matchAll(placeholderPattern)) {
      if (match[1] !== undefined) placeholders.add(match[1])
    }
  }
  return [...placeholders].sort()
}
