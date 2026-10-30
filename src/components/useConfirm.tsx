import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ConfirmDialog } from './ConfirmDialog.tsx'

export type ConfirmOptions = {
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
}

export function useConfirm(): {
  confirm: (options: ConfirmOptions) => Promise<boolean>
  dialog: ReactNode
} {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolveRef = useRef<((result: boolean) => void) | null>(null)

  const finish = useCallback((result: boolean) => {
    const resolve = resolveRef.current
    if (!resolve) return

    resolveRef.current = null
    setOptions(null)
    resolve(result)
  }, [])

  const confirm = useCallback((nextOptions: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current?.(false)
      resolveRef.current = resolve
      setOptions(nextOptions)
    })
  }, [])

  useEffect(() => {
    return () => {
      resolveRef.current?.(false)
      resolveRef.current = null
    }
  }, [])

  const dialog = options ? (
    <ConfirmDialog
      open
      {...options}
      onConfirm={() => finish(true)}
      onCancel={() => finish(false)}
    />
  ) : null

  return { confirm, dialog }
}
