import { describe, expect, it } from 'vitest'
import type { Card } from '../types.ts'
import {
  parseProject,
  PROJECT_VERSION,
  serializeProject,
  type ProjectSettings,
} from './project.ts'

const settings: ProjectSettings = {
  presetName: 'POKER',
  paperName: 'LETTER',
  exportMode: 'DUPLEX',
  pieceOrientation: 'AUTO',
}

function createCard(id = 'card-1'): Card {
  return {
    id,
    bleedMode: 'IMAGE',
    frontSrc: 'data:image/png;base64,front',
    backSrc: 'data:image/png;base64,back',
    frontProcessedSrc: 'processed-front',
    backProcessedSrc: 'processed-back',
    frontCrop: { x: 1, y: 2, width: 3, height: 4 },
    backCrop: { x: 5, y: 6, width: 7, height: 8 },
    frontBackground: { enabled: true, color: '#abc' },
    backBackground: { enabled: false, color: '#123456' },
    bleedColor: '#ffffff',
    quantity: 3,
  }
}

function parseCardUpdate(update: Record<string, unknown>) {
  const project = JSON.parse(serializeProject(settings, [createCard()])) as Record<string, unknown>
  const [card] = project.cards as Record<string, unknown>[]
  project.cards = [{ ...card, ...update }]
  return parseProject(JSON.stringify(project))
}

describe('project save/load', () => {
  it('round trips cards without processed sources', () => {
    const card = createCard()
    const parsed = parseProject(serializeProject(settings, [card]))

    expect(parsed).toEqual({
      ok: true,
      project: {
        version: PROJECT_VERSION,
        settings,
        cards: [{ ...card, frontProcessedSrc: undefined, backProcessedSrc: undefined }],
      },
      cards: [{ ...card, frontProcessedSrc: undefined, backProcessedSrc: undefined }],
    })
    if (parsed.ok) {
      expect(parsed.cards[0]).not.toHaveProperty('frontProcessedSrc')
      expect(parsed.cards[0]).not.toHaveProperty('backProcessedSrc')
    }
  })

  it('never serializes processed sources', () => {
    const text = serializeProject(settings, [createCard()])

    expect(text).not.toContain('processed-front')
    expect(text).not.toContain('processed-back')
    expect(text).not.toContain('ProcessedSrc')
  })

  it('round trips vector flags and accepts older projects without them', () => {
    const vectorCard = {
      ...createCard(),
      frontIsVector: true,
      backIsVector: false,
    }
    const parsedVectorCard = parseProject(serializeProject(settings, [vectorCard]))
    expect(parsedVectorCard.ok && parsedVectorCard.cards[0]).toMatchObject({
      frontIsVector: true,
      backIsVector: false,
    })

    const oldProject = JSON.parse(serializeProject(settings, [createCard()])) as {
      cards: Record<string, unknown>[]
    }
    delete oldProject.cards[0].frontIsVector
    delete oldProject.cards[0].backIsVector
    const parsedOldProject = parseProject(JSON.stringify(oldProject))

    expect(parsedOldProject.ok).toBe(true)
    if (parsedOldProject.ok) {
      expect(parsedOldProject.cards[0]).not.toHaveProperty('frontIsVector')
      expect(parsedOldProject.cards[0]).not.toHaveProperty('backIsVector')
    }
  })

  it('round trips an empty deck', () => {
    const parsed = parseProject(serializeProject(settings, []))

    expect(parsed).toEqual({
      ok: true,
      project: { version: PROJECT_VERSION, settings, cards: [] },
      cards: [],
    })
  })

  it('ignores unknown project and card fields', () => {
    const project = JSON.parse(serializeProject(settings, [createCard()]))
    project.extra = 'ignored'
    project.cards[0].extra = 'ignored'
    project.cards[0].frontBackground.extra = 'ignored'
    project.cards[0].frontCrop.extra = 'ignored'

    const parsed = parseProject(JSON.stringify(project))

    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.project).not.toHaveProperty('extra')
      expect(parsed.cards[0]).not.toHaveProperty('extra')
      expect(parsed.cards[0].frontBackground).not.toHaveProperty('extra')
      expect(parsed.cards[0].frontCrop).not.toHaveProperty('extra')
    }
  })

  it('produces deterministic, two-space-indented JSON', () => {
    const first = serializeProject(settings, [createCard()])

    expect(serializeProject(settings, [createCard()])).toBe(first)
    expect(first).toContain('\n  "version": 1')
  })

  it('rejects invalid JSON and malformed projects', () => {
    expect(parseProject('{')).toMatchObject({ ok: false, error: 'Invalid project JSON.' })
    expect(parseProject('[]')).toMatchObject({ ok: false, error: expect.stringContaining('object') })
    expect(parseProject('{"version":1,"settings":{},"cards":[]}')).toMatchObject({
      ok: false,
      error: expect.stringContaining('presetName'),
    })
  })

  it('explains when a project was made by a newer version', () => {
    const newer = serializeProject(settings, [])
      .replace('"version": 1', '"version": 2')

    expect(parseProject(newer)).toMatchObject({
      ok: false,
      error: expect.stringContaining('made by a newer version'),
    })
  })

  it.each([
    ['paperName', { paperName: 'LEGAL' }, 'paperName'],
    ['exportMode', { exportMode: 'PDF' }, 'exportMode'],
    ['pieceOrientation', { pieceOrientation: 'SIDEWAYS' }, 'pieceOrientation'],
  ])('rejects invalid setting %s', (_name, update, field) => {
    expect(parseProject(JSON.stringify({
      version: PROJECT_VERSION,
      settings: { ...settings, ...update },
      cards: [],
    }))).toMatchObject({ ok: false, error: expect.stringContaining(field) })
  })

  it.each([
    ['empty id', { id: '  ' }, '.id'],
    ['invalid bleed mode', { bleedMode: 'OTHER' }, '.bleedMode'],
    ['invalid front background', { frontBackground: { enabled: 'yes', color: '#fff' } }, '.frontBackground'],
    ['invalid back background', { backBackground: { enabled: true, color: 'red' } }, '.backBackground'],
    ['invalid front vector flag', { frontIsVector: 'yes' }, '.frontIsVector'],
    ['invalid back vector flag', { backIsVector: 1 }, '.backIsVector'],
    ['invalid bleed color', { bleedColor: '#abcd' }, '.bleedColor'],
    ['invalid crop coordinate', { frontCrop: { x: Infinity, y: 0, width: 1, height: 1 } }, '.frontCrop'],
    ['non-positive crop width', { frontCrop: { x: 0, y: 0, width: 0, height: 1 } }, '.frontCrop'],
    ['non-positive crop height', { backCrop: { x: 0, y: 0, width: 1, height: -1 } }, '.backCrop'],
    ['non-integer quantity', { quantity: 1.5 }, '.quantity'],
  ])('rejects %s', (_name, update, field) => {
    expect(parseCardUpdate(update)).toMatchObject({
      ok: false,
      error: expect.stringContaining(field),
    })
  })

  it('rejects duplicate ids', () => {
    const parsed = parseProject(serializeProject(settings, [createCard(), createCard()]))

    expect(parsed).toMatchObject({ ok: false, error: expect.stringContaining('duplicate id') })
  })

  it('clamps integer quantities to the supported range', () => {
    const below = parseCardUpdate({ quantity: -4 })
    const above = parseCardUpdate({ quantity: 1002 })

    expect(below.ok && below.cards[0].quantity).toBe(0)
    expect(above.ok && above.cards[0].quantity).toBe(999)
  })
})
