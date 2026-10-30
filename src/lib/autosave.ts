export type AutosaverOptions = {
  save: () => void | Promise<void>
  delayMs?: number
  onSaved?: () => void
  onError?: (error: unknown) => void
}

export function createAutosaver({
  save,
  delayMs = 800,
  onSaved,
  onError,
}: AutosaverOptions): {
  schedule(): void
  flush(): Promise<void>
  cancel(): void
} {
  let timer: ReturnType<typeof setTimeout> | undefined
  let running: Promise<void> | undefined
  let runAgain = false

  function startSave(): Promise<void> {
    if (running) {
      runAgain = true
      return running
    }

    const operation = Promise.resolve()
      .then(save)
      .then(() => onSaved?.())
      .catch((error: unknown) => {
        try {
          onError?.(error)
        } catch {
          return
        }
      })
      .then(async () => {
        running = undefined
        if (runAgain) {
          runAgain = false
          await startSave()
        }
      })
    running = operation
    return operation
  }

  function schedule(): void {
    if (running) {
      runAgain = true
      return
    }
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      void startSave()
    }, delayMs)
  }

  function flush(): Promise<void> {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    return startSave()
  }

  function cancel(): void {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    runAgain = false
  }

  return { schedule, flush, cancel }
}
