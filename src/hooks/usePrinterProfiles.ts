import { useState } from 'react'
import {
  addCalibration,
  calibrationFromObserved,
  clampCalibration,
  type CalibrationMm,
} from '../lib/calibration.ts'
import { parseMeasurement } from '../lib/calibrationInput.ts'
import {
  calibrationScaleY,
  estimatePrintScale,
  SHEET_WIDTH_MM,
} from '../lib/calibrationScale.ts'
import {
  addProfile,
  deleteProfile,
  exportCalibrationPt,
  loadPrinterProfiles,
  renameProfile,
  savePrinterProfiles,
  selectProfile,
  updateActiveOffsets,
  type PrinterProfiles,
} from '../lib/printerProfiles.ts'
import { calculateGrid, PAPER, type Size } from '../lib/geometry.ts'

type PaperName = keyof typeof PAPER
type Grid = ReturnType<typeof calculateGrid>

const ZERO_CALIBRATION_MM: CalibrationMm = { offsetXmm: 0, offsetYmm: 0 }

export function usePrinterProfiles({
  paper,
  paperName,
  grid,
  cardSize,
}: {
  paper: Size
  paperName: PaperName
  grid: Grid
  cardSize: Size
}) {
  const [printerProfiles, setPrinterProfiles] =
    useState<PrinterProfiles>(loadPrinterProfiles)
  const activeProfile =
    printerProfiles.profiles.find(({ id }) => id === printerProfiles.activeId) ??
    printerProfiles.profiles[0]
  const [calibrationDraft, setCalibrationDraft] = useState({
    offsetXmm: activeProfile.offsetXmm.toFixed(2),
    offsetYmm: activeProfile.offsetYmm.toFixed(2),
  })
  const [observedXmm, setObservedXmm] = useState('')
  const [observedYmm, setObservedYmm] = useState('')
  const [scaleGapInput, setScaleGapInput] = useState('')
  const [calibrationUpdated, setCalibrationUpdated] = useState(false)
  const [calibrationStorageWarning, setCalibrationStorageWarning] = useState<string>()

  const calibrationPt = exportCalibrationPt('CALIBRATED', activeProfile)
  const hasCalibrationScale =
    calibrationScaleY({ paper, grid, cardSize, backOffsetY: calibrationPt.offsetY }) !== null
  const scaleGapValue = parseMeasurement(scaleGapInput)
  const validScaleGap = scaleGapValue !== undefined && scaleGapValue >= 0
  const scaleEstimate =
    scaleGapValue !== undefined && scaleGapValue >= 0
      ? estimatePrintScale({
          sheetWidthMm: SHEET_WIDTH_MM[paperName],
          gapSpaces: scaleGapValue,
        })
      : undefined

  function persistPrinterProfiles(nextProfiles: PrinterProfiles) {
    setPrinterProfiles(nextProfiles)
    setCalibrationStorageWarning(
      savePrinterProfiles(nextProfiles)
        ? undefined
        : 'Calibration changes could not be saved; reloading may lose them.',
    )
  }

  function syncCalibrationDraft(profile: PrinterProfiles['profiles'][number]) {
    setCalibrationDraft({
      offsetXmm: profile.offsetXmm.toFixed(2),
      offsetYmm: profile.offsetYmm.toFixed(2),
    })
  }

  function persistActiveCalibration(nextCalibration: CalibrationMm) {
    const nextProfiles = updateActiveOffsets(printerProfiles, nextCalibration)
    const nextProfile =
      nextProfiles.profiles.find(({ id }) => id === nextProfiles.activeId) ??
      nextProfiles.profiles[0]
    persistPrinterProfiles(nextProfiles)
    syncCalibrationDraft(nextProfile)
  }

  function commitCalibrationAxis(axis: keyof CalibrationMm) {
    const input = calibrationDraft[axis]
    const value = input.trim() === '' ? Number.NaN : Number(input)
    if (!Number.isFinite(value)) {
      setCalibrationDraft((current) => ({
        ...current,
        [axis]: activeProfile[axis].toFixed(2),
      }))
      return
    }
    persistActiveCalibration({ ...activeProfile, [axis]: value })
  }

  function resetCalibration() {
    persistActiveCalibration(ZERO_CALIBRATION_MM)
    setCalibrationUpdated(false)
  }

  function applyObservedCorrection() {
    const currentCalibration = clampCalibration({
      offsetXmm:
        calibrationDraft.offsetXmm.trim() === ''
          ? activeProfile.offsetXmm
          : Number(calibrationDraft.offsetXmm),
      offsetYmm:
        calibrationDraft.offsetYmm.trim() === ''
          ? activeProfile.offsetYmm
          : Number(calibrationDraft.offsetYmm),
    })
    const observationX = parseMeasurement(observedXmm)
    const observationY = parseMeasurement(observedYmm)
    if (observationX === undefined || observationY === undefined) return

    const nextCalibration = clampCalibration(
      addCalibration(
        currentCalibration,
        calibrationFromObserved(observationX, observationY),
      ),
    )
    persistActiveCalibration(nextCalibration)
    setObservedXmm('')
    setObservedYmm('')
    setCalibrationUpdated(true)
  }

  function handleSelectPrinter(id: string) {
    const nextProfiles = selectProfile(printerProfiles, id)
    const nextProfile =
      nextProfiles.profiles.find(({ id: profileId }) => profileId === nextProfiles.activeId) ??
      nextProfiles.profiles[0]
    persistPrinterProfiles(nextProfiles)
    syncCalibrationDraft(nextProfile)
    setCalibrationUpdated(false)
  }

  function handleAddPrinter() {
    const name = window.prompt('New printer name', `Printer ${printerProfiles.profiles.length + 1}`)
    if (name === null) return
    const nextProfiles = addProfile(printerProfiles, name)
    if (nextProfiles === printerProfiles) return
    persistPrinterProfiles(nextProfiles)
    syncCalibrationDraft(nextProfiles.profiles[nextProfiles.profiles.length - 1])
    setCalibrationUpdated(false)
  }

  function handleRenamePrinter() {
    const name = window.prompt('Rename printer', activeProfile.name)
    if (name === null) return
    persistPrinterProfiles(renameProfile(printerProfiles, activeProfile.id, name))
  }

  function handleDeletePrinter() {
    if (
      !window.confirm(
        `Delete "${activeProfile.name}" (X ${activeProfile.offsetXmm >= 0 ? '+' : ''}${activeProfile.offsetXmm.toFixed(2)} mm, Y ${activeProfile.offsetYmm >= 0 ? '+' : ''}${activeProfile.offsetYmm.toFixed(2)} mm)? This cannot be undone.`,
      )
    ) {
      return
    }

    const nextProfiles = deleteProfile(printerProfiles, activeProfile.id)
    const nextProfile =
      nextProfiles.profiles.find(({ id }) => id === nextProfiles.activeId) ??
      nextProfiles.profiles[0]
    persistPrinterProfiles(nextProfiles)
    syncCalibrationDraft(nextProfile)
    setCalibrationUpdated(false)
  }

  return {
    printerProfiles,
    activeProfile,
    calibrationDraft,
    setCalibrationDraft,
    observedXmm,
    setObservedXmm,
    observedYmm,
    setObservedYmm,
    scaleGapInput,
    setScaleGapInput,
    calibrationUpdated,
    setCalibrationUpdated,
    calibrationStorageWarning,
    calibrationPt,
    hasCalibrationScale,
    validScaleGap,
    scaleEstimate,
    commitCalibrationAxis,
    resetCalibration,
    applyObservedCorrection,
    handleSelectPrinter,
    handleAddPrinter,
    handleRenamePrinter,
    handleDeletePrinter,
  }
}
