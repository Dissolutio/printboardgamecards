import type { Catalog, Message } from './messages.ts'

export type CopyProblem = { rule: string; detail: string }

const allowedUppercaseTerms = new Set(['DPI', 'PDF', 'SVG', 'DXF'])
const placeholderPattern = /\{[A-Za-z0-9_]+\}/g

function messageTexts(message: Message): string[] {
  return typeof message === 'string' ? [message] : Object.values(message)
}

function sentenceWordCount(sentence: string): number {
  return sentence.match(/\b[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*\b/gu)?.length ?? 0
}

export function checkMessage(text: string): CopyProblem[] {
  const plainText = text.replace(placeholderPattern, 'value')
  const problems: CopyProblem[] = []
  const add = (rule: string, detail: string) => problems.push({ rule, detail })

  if (/\b[\p{L}]+['’][\p{L}]+\b/u.test(plainText)) {
    add('contraction', 'Use words without apostrophe contractions.')
  }
  if (/\b(?:e\.g\.|i\.e\.)/iu.test(plainText)) {
    add('abbreviation', 'Write the example in full.')
  }
  if (/\(\s*s\s*\)/iu.test(plainText)) {
    add('plural-marker', 'Write a complete singular or plural message.')
  }
  if (plainText.includes('·')) {
    add('middle-dot', 'Use words or separate sentences instead of a middle dot.')
  }
  if (/[→←↑↓▲▼]/u.test(plainText)) {
    add('arrow', 'Explain the direction with words.')
  }
  if (/(^|\s)=(?=\s|$)/u.test(plainText)) {
    add('equals-sign', 'Explain the meaning with a complete sentence.')
  }
  const sentences = plainText.split(/[.!?]+/u)
  if (sentences.some((sentence) => sentenceWordCount(sentence) > 20)) {
    add('sentence-length', 'Use sentences with no more than 20 words.')
  }
  if (plainText.includes(';')) {
    add('semicolon', 'Write the sentences separately instead of joining them with a semicolon.')
  }
  const uppercaseWords = plainText.match(/\b[A-Z]{4,}\b/g) ?? []
  if (uppercaseWords.some((word) => !allowedUppercaseTerms.has(word))) {
    add('uppercase-emphasis', 'Do not use all capital letters for emphasis.')
  }
  if (/\bpiece\b/iu.test(plainText)) {
    add('preferred-term', 'Use “card” instead of “piece”.')
  }

  return problems
}

export function checkCatalog(
  catalog: Catalog,
): { key: string; problems: CopyProblem[] }[] {
  return Object.entries(catalog).flatMap(([key, message]) => {
    const problems = messageTexts(message).flatMap(checkMessage)
    return problems.length > 0 ? [{ key, problems }] : []
  })
}

export function checkPluralCompleteness(catalog: Catalog, locale: string): string[] {
  const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories
  return Object.entries(catalog)
    .filter((entry) => {
      const message = entry[1]
      if (typeof message === 'string') return false
      return categories.some((category) => message[category] === undefined)
    })
    .map(([key]) => key)
}
