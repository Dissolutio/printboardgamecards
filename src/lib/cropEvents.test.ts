import { describe, expect, it } from 'vitest'
import { shouldCommitCropEvent } from './cropEvents.ts'

describe('shouldCommitCropEvent', () => {
  it('does not commit events without a user action', () => {
    expect(shouldCommitCropEvent(false, false)).toBe(false)
  })

  it('commits completed user crop interactions', () => {
    expect(shouldCommitCropEvent(true, false)).toBe(true)
  })

  it('waits for zoom interactions to finish', () => {
    expect(shouldCommitCropEvent(true, true)).toBe(false)
  })
})
