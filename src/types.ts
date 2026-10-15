export type BleedMode = 'IMAGE' | 'COLOR'

export type PixelCropRect = {
  x: number
  y: number
  width: number
  height: number
}

export type Card = {
  id: string
  frontSrc?: string
  backSrc?: string
  frontProcessedSrc?: string
  backProcessedSrc?: string
  frontCrop?: PixelCropRect
  backCrop?: PixelCropRect
  backgroundColor: string
  bleedColor: string
  quantity: number
}

export type CardSide = 'front' | 'back'
