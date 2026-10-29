import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  addProfile,
  deleteProfile,
  duplexPdfFilename,
  exportCalibrationPt,
  hasCalibration,
  loadPrinterProfiles,
  PRINTER_PROFILES_STORAGE_KEY,
  profileFilenameSlug,
  renameProfile,
  sanitizeProfileName,
  savePrinterProfiles,
  selectProfile,
  updateActiveOffsets,
} from './printerProfiles.ts'
import { CALIBRATION_STORAGE_KEY } from './calibration.ts'
import {
  CARD_PRESETS,
  calculateGrid,
  DEFAULT_BLEED,
  mmToPt,
  PAPER,
} from './geometry.ts'
import { layoutDuplexPages } from './layout.ts'
import type { Card } from '../types.ts'

afterEach(() => vi.unstubAllGlobals())

function stubStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  const storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    values,
  }
  vi.stubGlobal('localStorage', storage)
  return storage
}

const defaultProfile = {
  id: 'my-printer',
  name: 'My printer',
  offsetXmm: 0,
  offsetYmm: 0,
}

describe('printer profile storage', () => {
  it('uses one default profile when storage is absent or corrupt', () => {
    stubStorage()
    expect(loadPrinterProfiles()).toEqual({
      profiles: [defaultProfile],
      activeId: defaultProfile.id,
    })

    stubStorage({ [PRINTER_PROFILES_STORAGE_KEY]: '{not-json' })
    expect(loadPrinterProfiles()).toEqual({
      profiles: [defaultProfile],
      activeId: defaultProfile.id,
    })
  })

  it('drops invalid profiles, repairs activeId, and clamps offsets', () => {
    stubStorage({
      [PRINTER_PROFILES_STORAGE_KEY]: JSON.stringify({
        version: 1,
        activeId: 'missing',
        profiles: [
          { id: 'first', name: ' First  printer ', offsetXmm: 12, offsetYmm: -14 },
          { id: 2, name: 'Invalid id', offsetXmm: 0, offsetYmm: 0 },
          { id: 'empty-name', name: '   ', offsetXmm: 0, offsetYmm: 0 },
          { id: 'nan', name: 'Invalid offset', offsetXmm: Number.NaN, offsetYmm: 0 },
          { id: 'second', name: 'Second', offsetXmm: 1, offsetYmm: 2 },
        ],
      }),
    })

    expect(loadPrinterProfiles()).toEqual({
      profiles: [
        { id: 'first', name: 'First printer', offsetXmm: 10, offsetYmm: -10 },
        { id: 'second', name: 'Second', offsetXmm: 1, offsetYmm: 2 },
      ],
      activeId: 'first',
    })
  })

  it('repairs duplicate ids deterministically and keeps the first active match', () => {
    stubStorage({
      [PRINTER_PROFILES_STORAGE_KEY]: JSON.stringify({
        version: 1,
        activeId: 'office',
        profiles: [
          { id: 'office', name: 'First office', offsetXmm: 1, offsetYmm: 2 },
          { id: 'office', name: 'Second office', offsetXmm: 3, offsetYmm: 4 },
          { id: 'office-duplicate', name: 'Existing id', offsetXmm: 5, offsetYmm: 6 },
          { id: 'office', name: 'Third office', offsetXmm: 7, offsetYmm: 8 },
          { id: 'office', name: 'Fourth office', offsetXmm: 9, offsetYmm: 10 },
        ],
      }),
    })

    expect(loadPrinterProfiles()).toEqual({
      profiles: [
        { id: 'office', name: 'First office', offsetXmm: 1, offsetYmm: 2 },
        { id: 'office-duplicate-2', name: 'Second office', offsetXmm: 3, offsetYmm: 4 },
        { id: 'office-duplicate', name: 'Existing id', offsetXmm: 5, offsetYmm: 6 },
        { id: 'office-duplicate-3', name: 'Third office', offsetXmm: 7, offsetYmm: 8 },
        { id: 'office-duplicate-4', name: 'Fourth office', offsetXmm: 9, offsetYmm: 10 },
      ],
      activeId: 'office',
    })
  })

  it('migrates valid legacy offsets without changing the legacy key', () => {
    const storage = stubStorage({
      [CALIBRATION_STORAGE_KEY]: JSON.stringify({ offsetXmm: 4, offsetYmm: -3 }),
    })

    expect(loadPrinterProfiles()).toEqual({
      profiles: [{ ...defaultProfile, offsetXmm: 4, offsetYmm: -3 }],
      activeId: defaultProfile.id,
    })
    expect(storage.values.get(CALIBRATION_STORAGE_KEY)).toBe(
      JSON.stringify({ offsetXmm: 4, offsetYmm: -3 }),
    )
  })

  it('uses zero offsets for invalid or absent legacy values', () => {
    stubStorage({ [CALIBRATION_STORAGE_KEY]: '{"offsetXmm":"bad","offsetYmm":2}' })
    expect(loadPrinterProfiles().profiles[0]).toEqual(defaultProfile)

    stubStorage()
    expect(loadPrinterProfiles().profiles[0]).toEqual(defaultProfile)
  })

  it('reports storage write failures', () => {
    const storage = stubStorage()
    storage.setItem.mockImplementation(() => {
      throw new Error('storage unavailable')
    })
    expect(
      savePrinterProfiles({ profiles: [defaultProfile], activeId: defaultProfile.id }),
    ).toBe(false)
  })
})

describe('printer profile helpers', () => {
  const initial = {
    profiles: [
      { ...defaultProfile, offsetXmm: 1 },
      { id: 'other', name: 'Other', offsetXmm: 0, offsetYmm: 0 },
    ],
    activeId: defaultProfile.id,
  }

  it('adds and renames profiles without mutating their inputs', () => {
    const added = addProfile(initial, '  My   office printer  ')
    expect(initial.profiles).toHaveLength(2)
    expect(added.profiles).toHaveLength(3)
    expect(added.profiles[2].name).toBe('My office printer')
    expect(added.activeId).toBe(added.profiles[2].id)

    const renamed = renameProfile(added, added.activeId, '  Renamed   printer ')
    expect(added.profiles[2].name).toBe('My office printer')
    expect(renamed.profiles[2].name).toBe('Renamed printer')
  })

  it('deletes profiles immutably, activates the first remaining, and keeps one', () => {
    const withActiveLast = { ...initial, activeId: 'other' }
    const deleted = deleteProfile(withActiveLast, 'other')
    expect(withActiveLast.profiles).toHaveLength(2)
    expect(deleted.profiles).toEqual([initial.profiles[0]])
    expect(deleted.activeId).toBe(defaultProfile.id)

    const last = deleteProfile(
      { profiles: [defaultProfile], activeId: defaultProfile.id },
      defaultProfile.id,
    )
    expect(last).toEqual({ profiles: [defaultProfile], activeId: defaultProfile.id })
  })

  it('selects profiles and updates only the active offsets with clamping', () => {
    const selected = selectProfile(initial, 'other')
    const updated = updateActiveOffsets(selected, { offsetXmm: -12, offsetYmm: 2 })

    expect(initial.activeId).toBe(defaultProfile.id)
    expect(selected.profiles).toEqual(initial.profiles)
    expect(updated.profiles).toEqual([
      initial.profiles[0],
      { ...initial.profiles[1], offsetXmm: -10, offsetYmm: 2 },
    ])
    expect(selectProfile(initial, 'missing')).toBe(initial)
  })

  it('stops adding profiles at ten', () => {
    const tenProfiles = {
      profiles: Array.from({ length: 10 }, (_, index) => ({
        id: `printer-${index}`,
        name: `Printer ${index}`,
        offsetXmm: 0,
        offsetYmm: 0,
      })),
      activeId: 'printer-0',
    }

    expect(addProfile(tenProfiles)).toBe(tenProfiles)
  })
})

describe('profile names and filenames', () => {
  it('sanitizes empty, whitespace, and long profile names', () => {
    expect(sanitizeProfileName('')).toBe('My printer')
    expect(sanitizeProfileName('   ')).toBe('My printer')
    expect(sanitizeProfileName('  My   office printer  ')).toBe('My office printer')
    expect(sanitizeProfileName('x'.repeat(50))).toBe('x'.repeat(40))
  })

  it('uses the sanitized fallback for empty profile names', () => {
    const profiles = { profiles: [defaultProfile], activeId: defaultProfile.id }
    const added = addProfile(profiles, '   ')
    const renamed = renameProfile(profiles, defaultProfile.id, '')

    expect(added.profiles[1].name).toBe('My printer')
    expect(renamed.profiles[0].name).toBe('My printer')
  })

  it('creates bounded lowercase slugs and uses a fallback for symbols', () => {
    expect(profileFilenameSlug('  My  OFFICE / Printer!! ')).toBe('my-office-printer')
    expect(profileFilenameSlug('***')).toBe('printer')
    expect(profileFilenameSlug('X'.repeat(40))).toBe('x'.repeat(24))
  })

  it('names original and calibrated duplex PDFs', () => {
    expect(duplexPdfFilename('ORIGINAL', 'LETTER', 'My office')).toBe(
      'printboard-cards-letter.pdf',
    )
    expect(duplexPdfFilename('CALIBRATED', 'A4', '  My  OFFICE / Printer!! ')).toBe(
      'printboard-cards-a4-calibrated-my-office-printer.pdf',
    )
  })
})

describe('duplex calibration exports', () => {
  const profile = {
    id: 'office',
    name: 'Office',
    offsetXmm: 1.25,
    offsetYmm: -2.5,
  }

  it('exports zero offsets for originals and converted offsets for calibrated PDFs', () => {
    expect(exportCalibrationPt('ORIGINAL', profile)).toEqual({ offsetX: 0, offsetY: 0 })
    expect(exportCalibrationPt('CALIBRATED', profile)).toEqual({
      offsetX: mmToPt(1.25),
      offsetY: mmToPt(-2.5),
    })
    expect(hasCalibration(profile)).toBe(true)
    expect(hasCalibration({ ...profile, offsetXmm: 0, offsetYmm: 0 })).toBe(false)
  })

  it('keeps front placements fixed and shifts only back placements by profile offsets', () => {
    const card: Card = {
      id: 'one-card',
      bleedMode: 'IMAGE',
      frontProcessedSrc: 'front',
      frontCrop: { x: 0, y: 0, width: 750, height: 1050 },
      frontBackground: { enabled: true, color: '#ffffff' },
      backBackground: { enabled: false, color: '#ffffff' },
      bleedColor: '#ffffff',
      quantity: 1,
    }
    const grid = calculateGrid({
      paper: PAPER.LETTER,
      card: CARD_PRESETS.POKER,
      bleed: DEFAULT_BLEED,
    })
    const original = layoutDuplexPages(
      [card],
      grid,
      exportCalibrationPt('ORIGINAL', profile),
    )[0]
    const calibrated = layoutDuplexPages([card], grid, exportCalibrationPt('CALIBRATED', profile))[0]
    const zeroOffset = layoutDuplexPages([card], grid, { offsetX: 0, offsetY: 0 })[0]

    expect(original.front).toEqual(calibrated.front)
    expect(original.back).toEqual(zeroOffset.back)
    expect(calibrated.back[0].x - original.back[0].x).toBeCloseTo(-mmToPt(profile.offsetXmm))
    expect(calibrated.back[0].y - original.back[0].y).toBeCloseTo(mmToPt(profile.offsetYmm))
  })
})
