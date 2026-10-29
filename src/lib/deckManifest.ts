export type DeckManifestCard = {
  id: string
  rank: 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'Joker'
  suit: 'S' | 'H' | 'D' | 'C' | null
  file: string
}

export type DeckManifest = {
  id: string
  name: string
  source: string
  commit: string
  license: string
  viewBox: {
    width: number
    height: number
  }
  cards: DeckManifestCard[]
}

type ParseResult =
  | { ok: true; manifest: DeckManifest }
  | { ok: false; error: string }

const manifestKeys = ['id', 'name', 'source', 'commit', 'license', 'viewBox', 'cards']
const cardKeys = ['id', 'rank', 'suit', 'file']
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'Joker']
const suits = ['S', 'H', 'D', 'C']

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key))
    && keys.every((key) => Object.hasOwn(value, key))
}

function isValidCard(value: unknown): value is DeckManifestCard {
  if (!isRecord(value) || !hasOnlyKeys(value, cardKeys)) return false

  return typeof value.id === 'string'
    && value.id.trim().length > 0
    && typeof value.rank === 'string'
    && ranks.includes(value.rank)
    && (value.rank === 'Joker'
      ? value.suit === null
      : typeof value.suit === 'string' && suits.includes(value.suit))
    && typeof value.file === 'string'
    && value.file.length > 0
    && value.file.endsWith('.svg')
    && !value.file.includes('/')
    && !value.file.includes('\\')
    && !value.file.includes('..')
}

export function parseDeckManifest(value: unknown): ParseResult {
  try {
    if (!isRecord(value)) {
      return { ok: false, error: 'Manifest must be a plain object.' }
    }

    if (!hasOnlyKeys(value, manifestKeys)) {
      return { ok: false, error: 'Manifest must contain only the required fields.' }
    }

    for (const key of ['id', 'name', 'source', 'commit', 'license']) {
      if (typeof value[key] !== 'string') {
        return { ok: false, error: `Manifest ${key} must be a string.` }
      }
    }

    if ((value.id as string).trim().length === 0) {
      return { ok: false, error: 'Manifest id must be a non-empty string.' }
    }

    if (!isRecord(value.viewBox) || !hasOnlyKeys(value.viewBox, ['width', 'height'])) {
      return { ok: false, error: 'Manifest viewBox must contain width and height.' }
    }

    if (
      typeof value.viewBox.width !== 'number'
      || !Number.isFinite(value.viewBox.width)
      || value.viewBox.width <= 0
      || typeof value.viewBox.height !== 'number'
      || !Number.isFinite(value.viewBox.height)
      || value.viewBox.height <= 0
    ) {
      return { ok: false, error: 'Manifest viewBox width and height must be positive finite numbers.' }
    }

    if (!Array.isArray(value.cards)) {
      return { ok: false, error: 'Manifest cards must be an array.' }
    }

    const cardIds = new Set<string>()
    for (const card of value.cards) {
      if (!isValidCard(card)) {
        return { ok: false, error: 'Each card must have a non-empty id, valid rank and suit, and a plain .svg filename.' }
      }
      if (cardIds.has(card.id)) {
        return { ok: false, error: `Duplicate card id: ${card.id}.` }
      }
      cardIds.add(card.id)
    }

    return { ok: true, manifest: value as unknown as DeckManifest }
  } catch {
    return { ok: false, error: 'Manifest could not be validated.' }
  }
}
