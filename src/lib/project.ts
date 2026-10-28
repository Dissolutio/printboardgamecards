import type { Card, CardBackground, PixelCropRect } from '../types.ts'

export const PROJECT_VERSION = 1

export type ProjectSettings = {
  presetName: string
  paperName: 'LETTER' | 'A4'
  exportMode: 'PRINT_GLUE' | 'DUPLEX'
  pieceOrientation: 'AUTO' | 'UPRIGHT' | 'ROTATED'
}

export type SavedCard = Omit<Card, 'frontProcessedSrc' | 'backProcessedSrc'>

export type ProjectFile = {
  version: 1
  settings: ProjectSettings
  cards: SavedCard[]
}

type ParseProjectResult =
  | { ok: true; project: ProjectFile; cards: Card[] }
  | { ok: false; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isColor(value: unknown): value is string {
  return typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
}

function isCrop(value: unknown): value is PixelCropRect {
  return (
    isRecord(value) &&
    typeof value.x === 'number' &&
    Number.isFinite(value.x) &&
    typeof value.y === 'number' &&
    Number.isFinite(value.y) &&
    typeof value.width === 'number' &&
    Number.isFinite(value.width) &&
    value.width > 0 &&
    typeof value.height === 'number' &&
    Number.isFinite(value.height) &&
    value.height > 0
  )
}

function copyCrop(crop: PixelCropRect): PixelCropRect {
  return {
    x: crop.x,
    y: crop.y,
    width: crop.width,
    height: crop.height,
  }
}

function isBackground(value: unknown): value is CardBackground {
  return (
    isRecord(value) &&
    typeof value.enabled === 'boolean' &&
    isColor(value.color)
  )
}

function copyBackground(background: CardBackground): CardBackground {
  return { enabled: background.enabled, color: background.color }
}

function isSettings(value: unknown): value is ProjectSettings {
  if (!isRecord(value)) return false
  if (typeof value.presetName !== 'string') return false
  if (value.paperName !== 'LETTER' && value.paperName !== 'A4') return false
  if (value.exportMode !== 'PRINT_GLUE' && value.exportMode !== 'DUPLEX') return false
  if (
    value.pieceOrientation !== 'AUTO' &&
    value.pieceOrientation !== 'UPRIGHT' &&
    value.pieceOrientation !== 'ROTATED'
  ) {
    return false
  }
  return true
}

function settingsError(value: unknown): string | undefined {
  if (!isRecord(value)) return 'Invalid project settings.'
  if (typeof value.presetName !== 'string') {
    return 'Invalid project settings.presetName: expected a string.'
  }
  if (value.paperName !== 'LETTER' && value.paperName !== 'A4') {
    return 'Invalid project settings.paperName: expected LETTER or A4.'
  }
  if (value.exportMode !== 'PRINT_GLUE' && value.exportMode !== 'DUPLEX') {
    return 'Invalid project settings.exportMode: expected PRINT_GLUE or DUPLEX.'
  }
  if (
    value.pieceOrientation !== 'AUTO' &&
    value.pieceOrientation !== 'UPRIGHT' &&
    value.pieceOrientation !== 'ROTATED'
  ) {
    return 'Invalid project settings.pieceOrientation: expected AUTO, UPRIGHT, or ROTATED.'
  }
  return undefined
}

function cardError(value: unknown, index: number): string | undefined {
  const prefix = `Invalid project card ${index + 1}`
  if (!isRecord(value)) return `${prefix}: expected an object.`
  if (typeof value.id !== 'string' || value.id.trim().length === 0) {
    return `${prefix}.id: expected a non-empty string.`
  }
  if (value.bleedMode !== 'IMAGE' && value.bleedMode !== 'COLOR') {
    return `${prefix}.bleedMode: expected IMAGE or COLOR.`
  }
  if (!isBackground(value.frontBackground)) {
    return `${prefix}.frontBackground: expected enabled and a valid color.`
  }
  if (!isBackground(value.backBackground)) {
    return `${prefix}.backBackground: expected enabled and a valid color.`
  }
  if (!isColor(value.bleedColor)) {
    return `${prefix}.bleedColor: expected a color in #rgb or #rrggbb format.`
  }
  if (value.frontSrc !== undefined && typeof value.frontSrc !== 'string') {
    return `${prefix}.frontSrc: expected a string.`
  }
  if (value.backSrc !== undefined && typeof value.backSrc !== 'string') {
    return `${prefix}.backSrc: expected a string.`
  }
  if (value.frontCrop !== undefined && !isCrop(value.frontCrop)) {
    return `${prefix}.frontCrop: expected finite crop values and positive width and height.`
  }
  if (value.backCrop !== undefined && !isCrop(value.backCrop)) {
    return `${prefix}.backCrop: expected finite crop values and positive width and height.`
  }
  if (typeof value.quantity !== 'number' || !Number.isInteger(value.quantity)) {
    return `${prefix}.quantity: expected an integer.`
  }
  return undefined
}

function saveCard(card: Card): SavedCard {
  return {
    id: card.id,
    bleedMode: card.bleedMode,
    ...(card.frontSrc !== undefined && { frontSrc: card.frontSrc }),
    ...(card.backSrc !== undefined && { backSrc: card.backSrc }),
    ...(card.frontCrop !== undefined && { frontCrop: copyCrop(card.frontCrop) }),
    ...(card.backCrop !== undefined && { backCrop: copyCrop(card.backCrop) }),
    frontBackground: copyBackground(card.frontBackground),
    backBackground: copyBackground(card.backBackground),
    bleedColor: card.bleedColor,
    quantity: card.quantity,
  }
}

export function serializeProject(settings: ProjectSettings, cards: Card[]): string {
  const project: ProjectFile = {
    version: PROJECT_VERSION,
    settings: {
      presetName: settings.presetName,
      paperName: settings.paperName,
      exportMode: settings.exportMode,
      pieceOrientation: settings.pieceOrientation,
    },
    cards: cards.map(saveCard),
  }
  return JSON.stringify(project, null, 2)
}

export function parseProject(text: string): ParseProjectResult {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Invalid project JSON.' }
  }

  if (!isRecord(value)) {
    return { ok: false, error: 'Invalid project: expected an object.' }
  }
  if (typeof value.version === 'number' && value.version > PROJECT_VERSION) {
    return { ok: false, error: 'This project was made by a newer version of the app.' }
  }
  if (value.version !== PROJECT_VERSION) {
    return { ok: false, error: `Unsupported project version: expected ${PROJECT_VERSION}.` }
  }

  const invalidSettings = settingsError(value.settings)
  if (invalidSettings) return { ok: false, error: invalidSettings }
  if (!isSettings(value.settings)) {
    return { ok: false, error: 'Invalid project settings.' }
  }
  if (!Array.isArray(value.cards)) {
    return { ok: false, error: 'Invalid project cards: expected an array.' }
  }

  const cards: Card[] = []
  const ids = new Set<string>()
  for (const [index, rawCard] of value.cards.entries()) {
    const invalidCard = cardError(rawCard, index)
    if (invalidCard) return { ok: false, error: invalidCard }

    const card = rawCard as SavedCard
    if (ids.has(card.id)) {
      return { ok: false, error: `Invalid project card ${index + 1}.id: duplicate id "${card.id}".` }
    }
    ids.add(card.id)
    cards.push({
      id: card.id,
      bleedMode: card.bleedMode,
      ...(card.frontSrc !== undefined && { frontSrc: card.frontSrc }),
      ...(card.backSrc !== undefined && { backSrc: card.backSrc }),
      ...(card.frontCrop !== undefined && { frontCrop: copyCrop(card.frontCrop) }),
      ...(card.backCrop !== undefined && { backCrop: copyCrop(card.backCrop) }),
      frontBackground: copyBackground(card.frontBackground),
      backBackground: copyBackground(card.backBackground),
      bleedColor: card.bleedColor,
      quantity: Math.max(0, Math.min(999, card.quantity)),
    })
  }

  const project: ProjectFile = {
    version: PROJECT_VERSION,
    settings: {
      presetName: value.settings.presetName,
      paperName: value.settings.paperName,
      exportMode: value.settings.exportMode,
      pieceOrientation: value.settings.pieceOrientation,
    },
    cards: cards.map(saveCard),
  }
  return { ok: true, project, cards }
}
