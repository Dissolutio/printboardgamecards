import type { Card } from '../types.ts'
import type { ProjectSettings } from './project.ts'

export const PROJECT_FILENAME = 'printcards-project.json'

type SettingsWithPreset<PresetName extends string> = Omit<ProjectSettings, 'presetName'> & {
  presetName: PresetName
}

type SettingsValidationResult<PresetName extends string> =
  | { ok: true; settings: SettingsWithPreset<PresetName> }
  | { ok: false; error: string }

export function validateProjectSettings<PresetName extends string>(
  settings: ProjectSettings,
  isPresetName: (name: string) => name is PresetName,
): SettingsValidationResult<PresetName> {
  if (!isPresetName(settings.presetName)) {
    return { ok: false, error: `Unknown card preset "${settings.presetName}".` }
  }
  return { ok: true, settings: { ...settings, presetName: settings.presetName } }
}

export function needsProjectReplacementConfirmation(
  cards: Card[],
  settings: ProjectSettings,
): boolean {
  if (
    settings.presetName !== 'POKER' ||
    settings.paperName !== 'LETTER' ||
    settings.exportMode !== 'PRINT_GLUE' ||
    settings.pieceOrientation !== 'AUTO'
  ) {
    return true
  }

  return cards.some(
    (card) =>
      Boolean(
        card.frontSrc ||
          card.backSrc ||
          card.frontProcessedSrc ||
          card.backProcessedSrc,
      ) ||
      card.bleedMode !== 'IMAGE' ||
      card.frontBackground.enabled ||
      card.frontBackground.color !== '#ffffff' ||
      card.backBackground.enabled ||
      card.backBackground.color !== '#ffffff' ||
      card.bleedColor !== '#ffffff' ||
      card.quantity !== 1,
  )
}

export async function convertProjectDataSourcesToBlobUrls(
  cards: Card[],
  convert: (dataUrl: string) => Promise<string>,
  onCreated?: (url: string) => void,
): Promise<Card[]> {
  const convertedCards: Card[] = []
  for (const card of cards) {
    let convertedCard = { ...card }
    for (const side of ['front', 'back'] as const) {
      const sourceKey = side === 'front' ? 'frontSrc' : 'backSrc'
      const source = convertedCard[sourceKey]
      if (source?.startsWith('data:')) {
        const blobUrl = await convert(source)
        onCreated?.(blobUrl)
        convertedCard = { ...convertedCard, [sourceKey]: blobUrl }
      }
    }
    convertedCards.push(convertedCard)
  }
  return convertedCards
}
