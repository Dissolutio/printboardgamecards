export type BleedMode = 'IMAGE' | 'COLOR'

export type PixelCropRect = {
  x: number
  y: number
  width: number
  height: number
}

export type Card = {
  id: string
  width: number
  height: number
  frontSrc?: string
  backSrc?: string
  frontCrop?: PixelCropRect
  backCrop?: PixelCropRect
  bleedMode: BleedMode
  bleedColor: string
  quantity: number
}

export type CardSide = 'front' | 'back'
