import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAutosaver } from './autosave.ts'

afterEach(() => {
  vi.useRealTimers()
})

describe('autosaver', () => {
  it('debounces scheduled saves', async () => {
    vi.useFakeTimers()
    const save = vi.fn(async () => {})
    const autosaver = createAutosaver({ save, delayMs: 800 })

    autosaver.schedule()
    await vi.advanceTimersByTimeAsync(500)
    autosaver.schedule()
    await vi.advanceTimersByTimeAsync(799)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)

    expect(save).toHaveBeenCalledTimes(1)
  })

  it('runs exactly one more save when scheduled during a save', async () => {
    vi.useFakeTimers()
    let finishSave: (() => void) | undefined
    const save = vi.fn(() => new Promise<void>((resolve) => {
      finishSave = resolve
    }))
    const autosaver = createAutosaver({ save, delayMs: 1 })

    autosaver.schedule()
    await vi.advanceTimersByTimeAsync(1)
    autosaver.schedule()
    autosaver.schedule()
    expect(save).toHaveBeenCalledTimes(1)
    finishSave?.()
    await vi.runAllTimersAsync()

    expect(save).toHaveBeenCalledTimes(2)
  })

  it('flushes pending work immediately', async () => {
    vi.useFakeTimers()
    const save = vi.fn(async () => {})
    const autosaver = createAutosaver({ save, delayMs: 800 })

    autosaver.schedule()
    await autosaver.flush()

    expect(save).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels pending work', async () => {
    vi.useFakeTimers()
    const save = vi.fn(async () => {})
    const autosaver = createAutosaver({ save, delayMs: 800 })

    autosaver.schedule()
    autosaver.cancel()
    await vi.advanceTimersByTimeAsync(800)

    expect(save).not.toHaveBeenCalled()
  })

  it('reports save errors without rejecting flush', async () => {
    const error = new Error('save failed')
    const onError = vi.fn()
    const autosaver = createAutosaver({
      save: async () => {
        throw error
      },
      onError,
    })

    await expect(autosaver.flush()).resolves.toBeUndefined()
    expect(onError).toHaveBeenCalledWith(error)
  })
})
