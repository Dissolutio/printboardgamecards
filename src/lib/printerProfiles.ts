import {
  CALIBRATION_STORAGE_KEY,
  clampCalibration,
  type CalibrationMm,
} from './calibration.ts'
import type { Calibration } from './layout.ts'
import { mmToPt } from './geometry.ts'

export type PrinterProfile = {
  id: string
  name: string
  offsetXmm: number
  offsetYmm: number
}

export type PrinterProfiles = {
  profiles: PrinterProfile[]
  activeId: string
}

export type ExportKind = 'ORIGINAL' | 'CALIBRATED'

export const PRINTER_PROFILES_STORAGE_KEY = 'printboardgamecards.printerProfiles'

const MAX_PROFILES = 10
const DEFAULT_PROFILE: PrinterProfile = {
  id: 'my-printer',
  name: 'My printer',
  offsetXmm: 0,
  offsetYmm: 0,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isCalibrationMm(value: unknown): value is CalibrationMm {
  return (
    isRecord(value) &&
    typeof value.offsetXmm === 'number' &&
    Number.isFinite(value.offsetXmm) &&
    typeof value.offsetYmm === 'number' &&
    Number.isFinite(value.offsetYmm)
  )
}

function isPrinterProfile(value: unknown): value is PrinterProfile {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    typeof value.offsetXmm === 'number' &&
    Number.isFinite(value.offsetXmm) &&
    typeof value.offsetYmm === 'number' &&
    Number.isFinite(value.offsetYmm)
  )
}

function defaultProfiles(offsets: CalibrationMm = { offsetXmm: 0, offsetYmm: 0 }): PrinterProfiles {
  const clampedOffsets = clampCalibration(offsets)
  const profile = { ...DEFAULT_PROFILE, ...clampedOffsets }
  return { profiles: [profile], activeId: profile.id }
}

export function sanitizeProfileName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, 40).trim() || 'My printer'
}

export function loadPrinterProfiles(): PrinterProfiles {
  let serialized: string | null
  try {
    serialized = globalThis.localStorage.getItem(PRINTER_PROFILES_STORAGE_KEY)
  } catch {
    return defaultProfiles()
  }

  if (serialized === null) {
    try {
      const legacy = globalThis.localStorage.getItem(CALIBRATION_STORAGE_KEY)
      if (legacy !== null) {
        const parsed: unknown = JSON.parse(legacy)
        if (isCalibrationMm(parsed)) return defaultProfiles(parsed)
      }
    } catch {
      return defaultProfiles()
    }
    return defaultProfiles()
  }

  try {
    const parsed: unknown = JSON.parse(serialized)
    if (
      !isRecord(parsed) ||
      parsed.version !== 1 ||
      !Array.isArray(parsed.profiles) ||
      typeof parsed.activeId !== 'string'
    ) {
      return defaultProfiles()
    }

    const validProfiles = parsed.profiles
      .filter(isPrinterProfile)
      .slice(0, MAX_PROFILES)
    const reservedIds = new Set(validProfiles.map(({ id }) => id))
    const usedIds = new Set<string>()
    const profiles = validProfiles.map((profile) => {
      let id = profile.id
      if (usedIds.has(id)) {
        const baseId = `${id}-duplicate`
        id = baseId
        let suffix = 2
        while (reservedIds.has(id) || usedIds.has(id)) {
          id = `${baseId}-${suffix}`
          suffix += 1
        }
      }
      usedIds.add(id)
      return {
        ...profile,
        id,
        name: sanitizeProfileName(profile.name),
        ...clampCalibration(profile),
      }
    })
    if (profiles.length === 0) return defaultProfiles()

    return {
      profiles,
      activeId: profiles.some(({ id }) => id === parsed.activeId)
        ? parsed.activeId
        : profiles[0].id,
    }
  } catch {
    return defaultProfiles()
  }
}

export function savePrinterProfiles(value: PrinterProfiles): boolean {
  try {
    globalThis.localStorage.setItem(
      PRINTER_PROFILES_STORAGE_KEY,
      JSON.stringify({ version: 1, ...value }),
    )
    return true
  } catch {
    return false
  }
}

function createProfileId(profiles: PrinterProfile[]): string {
  const generated =
    globalThis.crypto?.randomUUID?.() ??
    `printer-${Date.now()}-${Math.random().toString(36).slice(2)}`
  let id = generated
  let suffix = 1
  while (profiles.some((profile) => profile.id === id)) {
    id = `${generated}-${suffix}`
    suffix += 1
  }
  return id
}

export function addProfile(
  value: PrinterProfiles,
  name = `Printer ${value.profiles.length + 1}`,
): PrinterProfiles {
  if (value.profiles.length >= MAX_PROFILES) return value

  const profile: PrinterProfile = {
    id: createProfileId(value.profiles),
    name: sanitizeProfileName(name),
    offsetXmm: 0,
    offsetYmm: 0,
  }
  return {
    profiles: [...value.profiles, profile],
    activeId: profile.id,
  }
}

export function renameProfile(
  value: PrinterProfiles,
  id: string,
  name: string,
): PrinterProfiles {
  if (!value.profiles.some((profile) => profile.id === id)) return value
  return {
    ...value,
    profiles: value.profiles.map((profile) =>
      profile.id === id ? { ...profile, name: sanitizeProfileName(name) } : profile,
    ),
  }
}

export function deleteProfile(value: PrinterProfiles, id: string): PrinterProfiles {
  if (value.profiles.length <= 1 || !value.profiles.some((profile) => profile.id === id)) {
    return value
  }

  const profiles = value.profiles.filter((profile) => profile.id !== id)
  return {
    profiles,
    activeId:
      value.activeId === id
        ? profiles[0].id
        : value.activeId,
  }
}

export function selectProfile(value: PrinterProfiles, id: string): PrinterProfiles {
  return value.profiles.some((profile) => profile.id === id)
    ? { ...value, activeId: id }
    : value
}

export function updateActiveOffsets(
  value: PrinterProfiles,
  offsets: CalibrationMm,
): PrinterProfiles {
  const clamped = clampCalibration(offsets)
  return {
    ...value,
    profiles: value.profiles.map((profile) =>
      profile.id === value.activeId ? { ...profile, ...clamped } : profile,
    ),
  }
}

export function profileFilenameSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24)
      .replace(/-+$/g, '') || 'printer'
  )
}

export function exportCalibrationPt(
  kind: ExportKind,
  profile: PrinterProfile,
): Calibration {
  return kind === 'ORIGINAL'
    ? { offsetX: 0, offsetY: 0 }
    : {
        offsetX: mmToPt(profile.offsetXmm),
        offsetY: mmToPt(profile.offsetYmm),
      }
}

export function hasCalibration(profile: PrinterProfile): boolean {
  return profile.offsetXmm !== 0 || profile.offsetYmm !== 0
}

export function duplexPdfFilename(
  kind: ExportKind,
  paperName: string,
  profileName?: string,
): string {
  const base = `printboard-cards-${paperName.toLowerCase()}`
  return kind === 'ORIGINAL'
    ? `${base}.pdf`
    : `${base}-calibrated-${profileFilenameSlug(profileName ?? '')}.pdf`
}
