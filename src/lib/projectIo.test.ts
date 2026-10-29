import { describe, expect, it, vi } from 'vitest'
import type { Card } from '../types.ts'
import {
  convertProjectDataSourcesToBlobUrls,
  needsProjectReplacementConfirmation,
  validateProjectSettings,
} from './projectIo.ts'
import type { ProjectSettings } from './project.ts'

const defaultSettings: ProjectSettings = {
  presetName: 'POKER',
  paperName: 'LETTER',
  exportMode: 'PRINT_GLUE',
  pieceOrientation: 'AUTO',
}

function createCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    bleedMode: 'IMAGE',
    frontBackground: { enabled: false, color: '#ffffff' },
    backBackground: { enabled: false, color: '#ffffff' },
    bleedColor: '#ffffff',
    quantity: 1,
    ...overrides,
  }
}

describe('project I/O helpers', () => {
  it('only asks to replace a non-empty or non-default deck', () => {
    expect(needsProjectReplacementConfirmation([], defaultSettings)).toBe(false)
    expect(needsProjectReplacementConfirmation([createCard()], defaultSettings)).toBe(false)
    expect(
      needsProjectReplacementConfirmation(
        [createCard({ frontSrc: 'blob:front' })],
        defaultSettings,
      ),
    ).toBe(true)
    expect(
      needsProjectReplacementConfirmation(
        [createCard()],
        { ...defaultSettings, paperName: 'A4' },
      ),
    ).toBe(true)
    expect(
      needsProjectReplacementConfirmation(
        [createCard({ backBackground: { enabled: true, color: '#abc' } })],
        defaultSettings,
      ),
    ).toBe(true)
  })

  it('rejects unknown presets with a clear error', () => {
    const result = validateProjectSettings(
      { ...defaultSettings, presetName: 'UNKNOWN' },
      (name): name is 'POKER' | 'BRIDGE' => name === 'POKER' || name === 'BRIDGE',
    )

    expect(result).toEqual({ ok: false, error: 'Unknown card preset "UNKNOWN".' })
  })

  it('converts data sources and leaves existing blob sources alone', async () => {
    const convert = vi.fn(async (source: string) => `blob:converted-${source}`)
    const cards = [
      createCard({ frontSrc: 'data:image/png;base64,front', backSrc: 'blob:existing' }),
      createCard({ id: 'card-2', frontSrc: 'blob:also-existing' }),
    ]

    const result = await convertProjectDataSourcesToBlobUrls(cards, convert)

    expect(result[0].frontSrc).toBe('blob:converted-data:image/png;base64,front')
    expect(result[0].backSrc).toBe('blob:existing')
    expect(result[1].frontSrc).toBe('blob:also-existing')
    expect(convert).toHaveBeenCalledTimes(1)
  })

  it('propagates data source conversion failures', async () => {
    const convert = vi.fn(async () => {
      throw new Error('conversion failed')
    })

    await expect(
      convertProjectDataSourcesToBlobUrls(
        [createCard({ frontSrc: 'data:image/png;base64,front' })],
        convert,
      ),
    ).rejects.toThrow('conversion failed')
  })
})
