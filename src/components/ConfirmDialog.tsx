import type { CSSProperties } from 'react'
import { Dialog } from './Dialog.tsx'

type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmStyle: CSSProperties = destructive
    ? { backgroundColor: '#ff7aa2', color: '#10141c' }
    : { backgroundColor: '#7a5cff', color: '#fff' }

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button
            className="min-h-11 rounded-lg border px-4 font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              backgroundColor: '#1f2633',
              borderColor: '#2c3547',
              color: '#e8ecf4',
              minHeight: 44,
              outlineColor: '#8f7bff',
            }}
            type="button"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className="min-h-11 rounded-lg px-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
            data-destructive={destructive}
            style={{ ...confirmStyle, minHeight: 44, outlineColor: '#8f7bff' }}
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <p>{message}</p>
    </Dialog>
  )
}
