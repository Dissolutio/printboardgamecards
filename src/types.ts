export type BleedMode = 'IMAGE' | 'COLOR'

export type PixelCropRect = {
  x: number
  y: number
  width: number
  height: number
}

export type CardBackground = {
  enabled: boolean
  color: string
}

export type Card = {
  id: string
  bleedMode: BleedMode
  frontSrc?: string
  backSrc?: string
  frontIsVector?: boolean
  backIsVector?: boolean
  frontProcessedSrc?: string
  backProcessedSrc?: string
  frontCrop?: PixelCropRect
  backCrop?: PixelCropRect
  frontBackground: CardBackground
  backBackground: CardBackground
  bleedColor: string
  quantity: number
}

export type CardSide = 'front' | 'back'
