import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'

type DialogProps = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'lg'
  fullScreenOnPhone?: boolean
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'lg',
  fullScreenOnPhone = false,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return

    const dialog = dialogRef.current
    if (!dialog) return

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const firstFocusable = dialog.querySelector<HTMLElement>(
      '[autofocus], button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    ;(firstFocusable ?? dialog).focus()

    return () => {
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [open])

  if (!open) return null

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onCloseRef.current()
      return
    }

    if (event.key !== 'Tab') return

    const dialog = dialogRef.current
    if (!dialog) return
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    )
    if (focusable.length === 0) {
      event.preventDefault()
      dialog.focus()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const phoneClasses = fullScreenOnPhone
    ? 'max-[699px]:items-stretch max-[699px]:p-0'
    : ''
  const panelPhoneClasses = fullScreenOnPhone
    ? 'max-[699px]:h-full max-[699px]:max-h-full max-[699px]:max-w-none max-[699px]:rounded-none'
    : ''
  const widthClass = size === 'sm' ? 'max-w-lg' : 'max-w-[73.75rem]'

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${phoneClasses}`}
      style={{ backgroundColor: 'rgba(10, 13, 19, 0.8)' }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current()
      }}
    >
      <div
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`flex max-h-[90vh] w-full ${widthClass} flex-col overflow-hidden rounded-2xl border shadow-2xl ${panelPhoneClasses}`}
        role="dialog"
        style={{
          backgroundColor: '#181e29',
          borderColor: '#2c3547',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.6)',
        }}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <header className="shrink-0 border-b px-5 py-4" style={{ borderColor: '#2c3547' }}>
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer !== undefined && (
          <footer
            className="shrink-0 border-t bg-[#141922] p-4"
            style={{ borderColor: '#2c3547' }}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
