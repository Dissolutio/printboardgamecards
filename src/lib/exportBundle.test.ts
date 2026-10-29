import { describe, expect, it } from 'vitest'
import { unzipSync } from 'fflate'
import {
  BUNDLE_MIME,
  buildBundle,
  buildReadme,
  suggestedBundleName,
  validateEntryPath,
  type BundleEntry,
} from './exportBundle.ts'

describe('validateEntryPath', () => {
  it.each([
    '',
    '/absolute.pdf',
    'parent/../cards.pdf',
    '..',
    'folder\\cards.pdf',
    'C:cards.pdf',
    'folder/\u0000cards.pdf',
    'folder/',
    `${'a'.repeat(101)}.pdf`,
    `${'a'.repeat(100)}/${'b'.repeat(100)}`,
  ])('rejects %j', (path) => {
    expect(validateEntryPath(path)).toBeDefined()
  })

  it.each([
    'cards.pdf',
    'pdf/cards-letter.pdf',
    'cut-files/cards.svg',
    `${'a'.repeat(100)}/${'b'.repeat(99)}`,
  ])(
    'accepts %s',
    (path) => {
      expect(validateEntryPath(path)).toBeUndefined()
    },
  )
})

describe('buildBundle', () => {
  it('round-trips files and puts the README first', () => {
    const entries: BundleEntry[] = [
      { path: 'pdf/cards.pdf', data: new Uint8Array([0, 1, 255]) },
      { path: 'cut-files/cards.svg', data: '<svg/>', description: 'Cut paths' },
    ]
    const zip = buildBundle(entries)
    const files = unzipSync(zip)
    const names = Object.keys(files)
    const zipHeader = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)

    expect(BUNDLE_MIME).toBe('application/zip')
    expect(zipHeader.getUint16(10, true)).toBe(0)
    expect(zipHeader.getUint16(12, true)).toBe(0x21)
    expect(names[0]).toBe('README.txt')
    expect(names.slice(1)).toEqual(['cut-files/cards.svg', 'pdf/cards.pdf'])
    expect(files['pdf/cards.pdf']).toEqual(new Uint8Array([0, 1, 255]))
    expect(new TextDecoder().decode(files['cut-files/cards.svg'])).toBe('<svg/>')
    expect(new TextDecoder().decode(files['README.txt'])).toContain('Cut paths')
  })

  it('builds byte-identical archives regardless of entry order', () => {
    const entries: BundleEntry[] = [
      { path: 'b.txt', data: 'repeated text '.repeat(30) },
      { path: 'a.txt', data: 'another repeated text '.repeat(30) },
    ]

    expect(buildBundle(entries)).toEqual(buildBundle([...entries].reverse()))
  })

  it('stores already-compressed files and compresses text files', () => {
    const data = 'repetitive content '.repeat(100)

    const pdf = buildBundle([{ path: 'file.pdf', data }], { readme: false })
    const svg = buildBundle([{ path: 'file.svg', data }], { readme: false })

    expect(pdf.length).toBeGreaterThan(svg.length)
  })

  it('honors readme and compression options', () => {
    const entries: BundleEntry[] = [{ path: 'file.txt', data: 'text '.repeat(20) }]

    expect(Object.keys(unzipSync(buildBundle(entries, { readme: false })))).toEqual([
      'file.txt',
    ])
    expect(buildBundle(entries, { readme: false, level: 0 }).length).toBeGreaterThan(
      buildBundle(entries, { readme: false, level: 6 }).length,
    )
  })

  it.each([
    [
      [
        { path: 'Cards.txt', data: 'one' },
        { path: 'cards.txt', data: 'two' },
      ],
      {},
    ],
    [[{ path: 'README.txt', data: 'user README' }], {}],
  ])('rejects conflicting paths', (entries, options) => {
    expect(() => buildBundle(entries as BundleEntry[], options)).toThrow(RangeError)
  })
})

describe('buildReadme', () => {
  it('includes descriptions and all print reminders, wrapped to 72 columns', () => {
    const readme = buildReadme([
      { path: 'pdf/front.pdf', description: 'The card fronts' },
      { path: 'pdf/back.pdf', description: 'The card backs' },
      { path: 'cut-files/cards.svg' },
    ])

    expect(readme).toContain('pdf/front.pdf: The card fronts')
    expect(readme).toContain('pdf/back.pdf: The card backs')
    expect(readme).toContain('Other files:\n- cut-files/cards.svg')
    expect(readme).toContain('Print at 100% / "Actual Size" (never "Fit to page").')
    expect(readme).toContain('For duplex printing, use "Flip on Long Edge".')
    expect(readme).toContain('Registration marks are read from the front page.')
    expect(readme.split('\n').every((line) => line.length <= 72)).toBe(true)
    const longWordReadme = buildReadme([
      { path: 'file.txt', description: 'x'.repeat(150) },
    ])
    expect(longWordReadme.split('\n').every((line) => line.length <= 72)).toBe(true)
    expect(readme).toBe(buildReadme([
      { path: 'pdf/front.pdf', description: 'The card fronts' },
      { path: 'pdf/back.pdf', description: 'The card backs' },
      { path: 'cut-files/cards.svg' },
    ]))
    expect(buildReadme([], { generatedOn: '2026-10-29' })).toContain(
      'Generated on: 2026-10-29',
    )
    expect(buildReadme([])).not.toContain('Generated on:')
  })
})

describe('suggestedBundleName', () => {
  it.each([
    ['My Déck Name', 'LETTER', 'my-deck-name-letter.zip'],
    ['', 'A4', 'cards-a4.zip'],
    ['✨!!!', 'LETTER', 'cards-letter.zip'],
    [`${'a'.repeat(50)}`, 'A4', `${'a'.repeat(40)}-a4.zip`],
    ['MiXeD Case', 'LETTER', 'mixed-case-letter.zip'],
  ] as const)('converts %j', (deckName, paper, expected) => {
    expect(suggestedBundleName(deckName, paper)).toBe(expected)
  })
})
