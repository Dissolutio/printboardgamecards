import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog.tsx'

describe('ConfirmDialog', () => {
  it('labels the dialog and focuses the cancel action before confirmation', () => {
    const markup = renderToStaticMarkup(
      <ConfirmDialog
        open
        title="Replace every back"
        message="This replaces the back on every card."
        confirmLabel="Replace every back"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )

    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('aria-modal="true"')
    expect(markup).toContain('aria-labelledby=')
    expect(markup.indexOf('>Cancel</button>')).toBeLessThan(
      markup.indexOf('>Replace every back</button>'),
    )
    expect(markup).toContain('min-height:44px')
  })

  it('uses the destructive styling hook and accepts a custom cancel label', () => {
    const markup = renderToStaticMarkup(
      <ConfirmDialog
        open
        title="Delete card"
        message="This removes the card."
        confirmLabel="Delete card"
        cancelLabel="Keep card"
        destructive
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )

    expect(markup).toContain('data-destructive="true"')
    expect(markup).toContain('background-color:#ff7aa2')
    expect(markup).toContain('>Keep card</button>')
    expect(markup).not.toContain('>Cancel</button>')
  })

  it('does not render a closed dialog', () => {
    const markup = renderToStaticMarkup(
      <ConfirmDialog
        open={false}
        title="Confirm"
        message="Continue?"
        confirmLabel="Continue"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )

    expect(markup).toBe('')
  })
})
