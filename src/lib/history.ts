import type { PieceOrientation } from './geometry.ts'
import type { Card } from '../types.ts'
import { CARD_PRESETS, PAPER } from './geometry.ts'

export type HistorySettings = {
  presetName: keyof typeof CARD_PRESETS
  paperName: keyof typeof PAPER
  exportMode: 'PRINT_GLUE' | 'DUPLEX'
  pieceOrientation: PieceOrientation
}

export type HistorySnapshot = {
  cards: Card[]
  settings: HistorySettings
}

export type History = {
  past: HistorySnapshot[]
  present: HistorySnapshot
  future: HistorySnapshot[]
  lastCommit?: {
    coalesceKey?: string
    label?: string
    now: number
  }
}

export type CommitOptions = {
  label?: string
  coalesceKey?: string
  now: number
}

const MAX_UNDO_STEPS = 50
const COALESCE_WINDOW_MS = 800

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (
    typeof left !== 'object' ||
    left === null ||
    typeof right !== 'object' ||
    right === null
  ) {
    return false
  }
  if (Array.isArray(left) !== Array.isArray(right)) return false

  const leftEntries = Object.entries(left)
  const rightEntries = Object.entries(right)
  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every(
      ([key, value]) =>
        Object.hasOwn(right, key) &&
        deepEqual(value, (right as Record<string, unknown>)[key]),
    )
  )
}

function shareUnchangedCards(
  previous: Card[],
  next: Card[],
): Card[] {
  const previousById = new Map(previous.map((card) => [card.id, card]))
  return next.map((card) => {
    const previousCard = previousById.get(card.id)
    return previousCard && deepEqual(previousCard, card) ? previousCard : card
  })
}

function withSharedCards(previous: HistorySnapshot, next: HistorySnapshot): HistorySnapshot {
  return {
    cards: shareUnchangedCards(previous.cards, next.cards),
    settings: next.settings,
  }
}

export function createHistory(initial: HistorySnapshot): History {
  return { past: [], present: initial, future: [] }
}

export function commit(
  history: History,
  snapshot: HistorySnapshot,
  options: CommitOptions,
): History {
  const nextSnapshot = withSharedCards(history.present, snapshot)
  if (
    deepEqual(history.present.cards, nextSnapshot.cards) &&
    deepEqual(history.present.settings, nextSnapshot.settings)
  ) {
    return history
  }

  const coalesces =
    options.coalesceKey !== undefined &&
    options.coalesceKey === history.lastCommit?.coalesceKey &&
    options.now >= history.lastCommit.now &&
    options.now - history.lastCommit.now <= COALESCE_WINDOW_MS

  return {
    past: coalesces
      ? history.past
      : [...history.past, history.present].slice(-MAX_UNDO_STEPS),
    present: nextSnapshot,
    future: [],
    lastCommit: {
      coalesceKey: options.coalesceKey,
      label: options.label,
      now: options.now,
    },
  }
}

export function undo(history: History): History {
  if (history.past.length === 0) return history
  const present = history.past[history.past.length - 1]
  if (!present) return history
  return {
    past: history.past.slice(0, -1),
    present,
    future: [history.present, ...history.future],
  }
}

export function redo(history: History): History {
  const present = history.future[0]
  if (!present) return history
  return {
    past: [...history.past, history.present].slice(-MAX_UNDO_STEPS),
    present,
    future: history.future.slice(1),
  }
}

export function canUndo(history: History): boolean {
  return history.past.length > 0
}

export function canRedo(history: History): boolean {
  return history.future.length > 0
}

export function retainedUrls(history: History): Set<string> {
  const urls = new Set<string>()
  for (const snapshot of [...history.past, history.present, ...history.future]) {
    for (const card of snapshot.cards) {
      for (const url of [
        card.frontSrc,
        card.backSrc,
        card.frontProcessedSrc,
        card.backProcessedSrc,
      ]) {
        if (url) urls.add(url)
      }
    }
  }
  return urls
}

export function replacePresent(
  history: History,
  snapshot: HistorySnapshot,
): History {
  return {
    ...history,
    present: withSharedCards(history.present, snapshot),
  }
}
