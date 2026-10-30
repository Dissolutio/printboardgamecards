import { describe, expect, it } from 'vitest'
import { createCard } from './cardOps.ts'
import {
  canRedo,
  canUndo,
  commit,
  createHistory,
  redo,
  retainedUrls,
  undo,
  type HistorySettings,
  type HistorySnapshot,
} from './history.ts'

const settings: HistorySettings = {
  presetName: 'POKER',
  paperName: 'LETTER',
  exportMode: 'PRINT_GLUE',
  pieceOrientation: 'AUTO',
}

function snapshot(cards = [createCard('card-1')]): HistorySnapshot {
  return { cards, settings }
}

describe('history', () => {
  it('commits snapshots and supports undo and redo', () => {
    const initial = snapshot()
    const updated = snapshot([{ ...initial.cards[0]!, quantity: 2 }])
    const committed = commit(createHistory(initial), updated, { now: 1 })

    expect(canUndo(committed)).toBe(true)
    expect(undo(committed).present).toBe(initial)
    expect(canRedo(undo(committed))).toBe(true)
    expect(redo(undo(committed)).present.cards[0]?.quantity).toBe(2)
  })

  it('clears redo history when a new snapshot is committed', () => {
    const initial = snapshot()
    const first = commit(
      createHistory(initial),
      snapshot([{ ...initial.cards[0]!, quantity: 2 }]),
      { now: 1 },
    )
    const undone = undo(first)
    const branched = commit(
      undone,
      snapshot([{ ...initial.cards[0]!, quantity: 3 }]),
      { now: 2 },
    )

    expect(canRedo(branched)).toBe(false)
  })

  it('retains at most 50 undo steps', () => {
    let history = createHistory(snapshot())
    for (let count = 2; count <= 53; count += 1) {
      history = commit(
        history,
        snapshot([{ ...history.present.cards[0]!, quantity: count }]),
        { now: count },
      )
    }

    expect(history.past).toHaveLength(50)
    expect(canUndo(undo(history))).toBe(true)
    expect(undo(history).past).toHaveLength(49)
  })

  it('coalesces matching commits inside 800 milliseconds', () => {
    const initial = snapshot()
    const first = commit(
      createHistory(initial),
      snapshot([{ ...initial.cards[0]!, quantity: 2 }]),
      { coalesceKey: 'card-1:quantity', now: 100 },
    )
    const second = commit(
      first,
      snapshot([{ ...first.present.cards[0]!, quantity: 3 }]),
      { coalesceKey: 'card-1:quantity', now: 900 },
    )

    expect(second.past).toHaveLength(1)
    expect(undo(second).present).toBe(initial)
  })

  it('does not coalesce commits outside the window or with different keys', () => {
    const initial = snapshot()
    const first = commit(
      createHistory(initial),
      snapshot([{ ...initial.cards[0]!, quantity: 2 }]),
      { coalesceKey: 'card-1:quantity', now: 100 },
    )
    const outsideWindow = commit(
      first,
      snapshot([{ ...first.present.cards[0]!, quantity: 3 }]),
      { coalesceKey: 'card-1:quantity', now: 901 },
    )
    const differentKey = commit(
      outsideWindow,
      snapshot([{ ...outsideWindow.present.cards[0]!, quantity: 4 }]),
      { coalesceKey: 'card-1:bleedColor', now: 902 },
    )

    expect(outsideWindow.past).toHaveLength(2)
    expect(differentKey.past).toHaveLength(3)
  })

  it('tracks URLs while deleted cards can still be restored', () => {
    const card = { ...createCard('card-1'), frontSrc: 'blob:front-image' }
    let history = createHistory(snapshot([card]))
    history = commit(history, snapshot([]), { now: 1 })

    expect(retainedUrls(history)).toContain('blob:front-image')
    expect(retainedUrls(undo(history))).toContain('blob:front-image')
  })

  it('drops URLs when the snapshot that retained them falls off the cap', () => {
    const card = { ...createCard('card-1'), frontSrc: 'blob:front-image' }
    let history = createHistory(snapshot([card]))
    history = commit(history, snapshot([]), { now: 1 })

    for (let count = 0; count < 50; count += 1) {
      history = commit(
        history,
        snapshot([{ ...createCard('card-1'), quantity: count + 1 }]),
        { now: count + 2 },
      )
    }

    expect(retainedUrls(history)).not.toContain('blob:front-image')
  })

  it('restores a replaced image when undone', () => {
    const oldImage = { ...createCard('card-1'), frontSrc: 'blob:old-image' }
    const newImage = { ...oldImage, frontSrc: 'blob:new-image' }
    const history = commit(
      createHistory(snapshot([oldImage])),
      snapshot([newImage]),
      { now: 1 },
    )

    expect(undo(history).present.cards[0]?.frontSrc).toBe('blob:old-image')
    expect(retainedUrls(history)).toContain('blob:old-image')
  })

  it('reuses unchanged card objects when committing a new snapshot', () => {
    const unchanged = createCard('unchanged')
    const changed = createCard('changed')
    const history = createHistory(snapshot([unchanged, changed]))
    const next = commit(
      history,
      snapshot([{ ...unchanged }, { ...changed, quantity: 2 }]),
      { now: 1 },
    )

    expect(next.present.cards[0]).toBe(unchanged)
    expect(next.present.cards[1]).not.toBe(changed)
  })
})
