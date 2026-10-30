import { useState } from 'react'
import {
  CARD_PRESETS,
  PAPER,
  type PieceOrientation,
} from '../lib/geometry.ts'

export type PaperName = keyof typeof PAPER
export type PresetName = keyof typeof CARD_PRESETS
export type ExportMode = 'PRINT_GLUE' | 'DUPLEX'

export function useSettings() {
  const [presetName, setPresetName] = useState<PresetName>('POKER')
  const [paperName, setPaperName] = useState<PaperName>('LETTER')
  const [exportMode, setExportMode] = useState<ExportMode>('PRINT_GLUE')
  const [pieceOrientation, setPieceOrientation] = useState<PieceOrientation>('AUTO')

  return {
    presetName,
    setPresetName,
    paperName,
    setPaperName,
    exportMode,
    setExportMode,
    pieceOrientation,
    setPieceOrientation,
  }
}
