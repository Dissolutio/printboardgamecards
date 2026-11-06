import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from './App.tsx'

describe('App card editor entry point', () => {
  it('starts on the deck screen without opening the card editor', () => {
    const markup = renderToStaticMarkup(<App />)

    expect(markup).toContain('Start with one card')
    expect(markup).not.toContain('role="dialog"')
  })
})
