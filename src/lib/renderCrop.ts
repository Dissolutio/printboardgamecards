import type { Size } from './geometry.ts'
import type { PixelCropRect } from '../types.ts'
import { intersectCrop } from './intersectCrop.ts'

function loadImage(sourceUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load the image for cropping.'))
    image.src = sourceUrl
  })
}

export async function loadImageSize(sourceUrl: string): Promise<Size> {
  const image = await loadImage(sourceUrl)
  if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
    throw new Error('The image has invalid dimensions.')
  }

  return { width: image.naturalWidth, height: image.naturalHeight }
}

export async function renderCrop(
  sourceUrl: string,
  crop: PixelCropRect,
  areaSize: Size,
): Promise<Blob> {
  const image = await loadImage(sourceUrl)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round((areaSize.width * 300) / 72)
  canvas.height = Math.round((areaSize.height * 300) / 72)

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not prepare the crop canvas.')

  const intersection = intersectCrop(crop, {
    width: image.naturalWidth,
    height: image.naturalHeight,
  })
  if (intersection) {
    const { source, destination } = intersection
    context.drawImage(
      image,
      source.x,
      source.y,
      source.width,
      source.height,
      (destination.x / crop.width) * canvas.width,
      (destination.y / crop.height) * canvas.height,
      (destination.width / crop.width) * canvas.width,
      (destination.height / crop.height) * canvas.height,
    )
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('Could not create the cropped image.'))
      }
    }, 'image/png')
  })
}
