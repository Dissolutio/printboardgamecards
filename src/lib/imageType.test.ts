import { describe, expect, it } from 'vitest'
import { getImageType } from './imageType.ts'

describe('getImageType', () => {
  it.each([
    ['image.png', 'image/png'],
    ['image.jpg', 'image/jpeg'],
    ['image.jpeg', 'image/jpeg'],
    ['image.webp', 'image/webp'],
    ['image.gif', 'image/gif'],
    ['image.bmp', 'image/bmp'],
    ['image.avif', 'image/avif'],
    ['image.svg', 'image/svg+xml'],
  ])('infers the type of %s', (name, type) => {
    expect(getImageType({ type: '', name })).toBe(type)
    expect(getImageType({ type: 'application/octet-stream', name })).toBe(type)
  })

  it('matches upper-case extensions', () => {
    expect(getImageType({ type: '', name: 'image.SVG' })).toBe('image/svg+xml')
  })

  it.each(['image', 'image.unknown'])('returns no type for %s', (name) => {
    expect(getImageType({ type: '', name })).toBeUndefined()
    expect(getImageType({ type: 'application/octet-stream', name })).toBeUndefined()
  })

  it('keeps the file type when it is already set', () => {
    expect(getImageType({ type: 'image/png', name: 'image.unknown' })).toBe('image/png')
  })
})
