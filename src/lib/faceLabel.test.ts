import { describe, expect, it } from 'vitest'
import { accessibleFaceName, emptyFaceLabel } from './faceLabel.ts'

describe('emptyFaceLabel', () => {
  it('shows no text when an image is present', () => {
    for (const side of ['front', 'back'] as const) {
      expect(emptyFaceLabel({ side, hasImage: true, hasBackground: false })).toBeUndefined()
      expect(emptyFaceLabel({ side, hasImage: true, hasBackground: true })).toBeUndefined()
    }
  })

  it('shows no text for a background without an image', () => {
    for (const side of ['front', 'back'] as const) {
      expect(emptyFaceLabel({ side, hasImage: false, hasBackground: true })).toBeUndefined()
    }
  })

  it('labels an empty front and back separately', () => {
    expect(
      emptyFaceLabel({ side: 'front', hasImage: false, hasBackground: false }),
    ).toBe('No front image')
    expect(
      emptyFaceLabel({ side: 'back', hasImage: false, hasBackground: false }),
    ).toBe('No back image')
  })
})

describe('accessibleFaceName', () => {
  it('names a background without an image', () => {
    expect(
      accessibleFaceName({ side: 'front', hasImage: false, hasBackground: true }),
    ).toBe('Front side: background color, no image.')
    expect(
      accessibleFaceName({ side: 'back', hasImage: false, hasBackground: true }),
    ).toBe('Back side: background color, no image.')
  })

  it('does not add a name when visible text or an image identifies the face', () => {
    for (const side of ['front', 'back'] as const) {
      expect(accessibleFaceName({ side, hasImage: true, hasBackground: false })).toBeUndefined()
      expect(accessibleFaceName({ side, hasImage: true, hasBackground: true })).toBeUndefined()
      expect(accessibleFaceName({ side, hasImage: false, hasBackground: false })).toBeUndefined()
    }
  })
})
