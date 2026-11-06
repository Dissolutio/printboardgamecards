import type { Card } from '../types.ts'
import { createTranslator } from '../i18n/messages.ts'
import { en } from '../i18n/en.ts'

const translate = createTranslator(en, 'en')

export default function SelectedCardEditor({ card }: { card?: Card }) {
  return card ? null : (
    <p className="mb-6 rounded-box bg-base-100 p-6 text-center text-base-content/60">
      {translate('cardEditor.emptyDeck')}
    </p>
  )
}
