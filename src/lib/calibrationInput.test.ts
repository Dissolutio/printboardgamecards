import { describe, expect, it } from 'vitest'
import { parseMeasurement } from './calibrationInput.ts'

describe('parseMeasurement', () => {
  it.each([
    ['', undefined],
    ['   ', undefined],
    ['0', 0],
    ['-0.3', -0.3],
    ['1e2', 100],
    ['abc', undefined],
    ['NaN', undefined],
    ['Infinity', undefined],
  ])('parses %j as %j', (input, expected) => {
    expect(parseMeasurement(input)).toBe(expected)
  })
})
