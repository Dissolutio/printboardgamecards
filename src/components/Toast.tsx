import { useEffect, useRef, useState } from 'react'

type ToastProps = {
  message: string
  actionLabel: string
  onAction: () => void
}

export default function Toast({
  message,
  actionLabel,
  onAction,
}: ToastProps) {
  const toastRef = useRef<HTMLDivElement>(null)
  const [bottom, setBottom] = useState(16)

  useEffect(() => {
    function keepDownloadVisible() {
      const toast = toastRef.current
      if (!toast) return
      const height = toast.getBoundingClientRect().height
      const viewportHeight = window.innerHeight
      let nextBottom = 16
      const downloadButtons = document.querySelectorAll<HTMLButtonElement>(
        '[data-download-button]',
      )

      for (const button of downloadButtons) {
        const bounds = button.getBoundingClientRect()
        if (bounds.bottom <= 0 || bounds.top >= viewportHeight) continue
        const toastTop = viewportHeight - nextBottom - height
        if (bounds.bottom <= toastTop || bounds.top >= viewportHeight - nextBottom) {
          continue
        }

        const aboveTop = bounds.top - height - 12
        if (aboveTop >= 8) {
          nextBottom = viewportHeight - aboveTop
        } else {
          const belowTop = bounds.bottom + 12
          nextBottom =
            belowTop + height <= viewportHeight - 8
              ? viewportHeight - belowTop - height
              : Math.max(16, viewportHeight - bounds.top + 12)
        }
        break
      }
      setBottom(nextBottom)
    }

    keepDownloadVisible()
    window.addEventListener('resize', keepDownloadVisible)
    window.addEventListener('scroll', keepDownloadVisible, true)
    return () => {
      window.removeEventListener('resize', keepDownloadVisible)
      window.removeEventListener('scroll', keepDownloadVisible, true)
    }
  }, [message])

  return (
    <div
      ref={toastRef}
      className="fixed inset-x-4 z-50 mx-auto flex max-w-lg items-center justify-between gap-4 rounded-box border border-base-300 bg-base-100 p-3 shadow-lg"
      style={{ bottom }}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <p className="text-sm">{message}</p>
      <button
        className="btn btn-primary min-h-11 shrink-0"
        type="button"
        onClick={onAction}
      >
        {actionLabel}
      </button>
    </div>
  )
}
