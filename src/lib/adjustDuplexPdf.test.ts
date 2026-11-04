import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { PDFDocument, degrees, rgb } from '@cantoo/pdf-lib'
import { describe, expect, it } from 'vitest'
import {
  applyCalibration,
  calculateGrid,
  CARD_PRESETS,
  mmToPt,
  PAPER,
} from './geometry.ts'
import { adjustDuplexPdf, backShiftPt } from './adjustDuplexPdf.ts'
import type { Card } from '../types.ts'
import DuplexDoc from '../pdf/DuplexDoc.tsx'

const encryptedPdf =
  'JVBERi0xLjcKJeLjz9MKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAxMDAgMTIwXSA+PgplbmRvYmoKNCAwIG9iago8PCAvRmlsdGVyIC9TdGFuZGFyZCAvViAxIC9SIDIgL0xlbmd0aCA0MCAvTyA8MzY0ZTM3MzdmNGQzNmU2ZmJhZDljZTMxZDliNmQ0NDBlMzlhYzY0N2ZhMTY4ZjRjYTc4OTY0NDEzY2I5OGU2Mz4gL1UgPDZkYTAzZWI4NWRkZTdiZTEwYWQyOGE0NGYwZWU2ZTE2MjA1YjgwOTdjYWQxMTVhNDk5NmYwZjA4Mzc2MTUzNTY+IC9QIC00ID4+CmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDA2NCAwMDAwMCBuIAowMDAwMDAwMTIxIDAwMDAwIG4gCjAwMDAwMDAxOTIgMDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgNSAvUm9vdCAxIDAgUiAvRW5jcnlwdCA0IDAgUiAvSUQgWzwwMDExMjIzMzQ0NTU2Njc3ODg5OWFhYmJjY2RkZWVmZj4gPDAwMTEyMjMzNDQ1NTY2Nzc4ODk5YWFiYmNjZGRlZWZmPl0gPj4Kc3RhcnR4cmVmCjM5OAolJUVPRgo'
const pixel =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII='

async function createPdf(sizes: Array<[number, number]>): Promise<Uint8Array> {
  const document = await PDFDocument.create({ updateMetadata: false })

  sizes.forEach(([width, height], index) => {
    const page = document.addPage([width, height])
    page.drawRectangle({
      x: 20 + index * 5,
      y: 30 + index * 5,
      width: 20,
      height: 25,
      color: rgb(1, 0, 0),
    })
  })

  return document.save()
}

function marker(page: ReturnType<PDFDocument['getPages']>[number]) {
  const graphics = page.extractContents().find((asset) => asset.kind === 'graphics')
  if (!graphics || graphics.kind !== 'graphics') {
    throw new Error('The marker rectangle was not found.')
  }
  return graphics
}

function imageMarker(page: ReturnType<PDFDocument['getPages']>[number]) {
  const image = page.extractContents().find((asset) => asset.kind === 'image')
  if (!image || image.kind !== 'image') {
    throw new Error('The image marker was not found.')
  }
  return image
}

const defaultOptions = { offsetXmm: 1.25, offsetYmm: -2.5 }

describe('backShiftPt', () => {
  it.each([
    [1, 0],
    [0, -2.5],
    [1.25, -2.5],
    [-3, 4.5],
  ])('matches applyCalibration for offsets %s mm and %s mm', (offsetXmm, offsetYmm) => {
    const origin = { x: 25, y: 50 }
    const back = applyCalibration(origin, {
      offsetX: mmToPt(offsetXmm),
      offsetY: mmToPt(offsetYmm),
    }).back
    const shift = backShiftPt(offsetXmm, offsetYmm)

    expect(shift.dx).toBeCloseTo(back.x - origin.x)
    expect(shift.dy).toBeCloseTo(-(back.y - origin.y))
  })

  it('returns zero without negative zero', () => {
    expect(backShiftPt(0, 0)).toEqual({ dx: 0, dy: 0 })
  })
})

describe('adjustDuplexPdf', () => {
  it('keeps front markers and moves back markers on mixed-size pages', async () => {
    const input = await createPdf([
      [200, 300],
      [250, 350],
      [300, 400],
      [350, 450],
    ])
    const original = await PDFDocument.load(input)
    const result = await adjustDuplexPdf(input, defaultOptions)
    const adjusted = await PDFDocument.load(result.bytes)
    const shift = backShiftPt(defaultOptions.offsetXmm, defaultOptions.offsetYmm)

    expect(result.pageCount).toBe(4)
    expect(result.shiftedPages).toEqual([2, 4])
    expect(result.warnings).toEqual([])

    original.getPages().forEach((page, index) => {
      const adjustedPage = adjusted.getPages()[index]
      expect(adjustedPage?.getMediaBox()).toEqual(page.getMediaBox())
      const originalMarker = marker(page)
      const adjustedMarker = marker(adjustedPage!)

      expect(adjustedMarker.x).toBeCloseTo(originalMarker.x + (index % 2 ? shift.dx : 0))
      expect(adjustedMarker.y).toBeCloseTo(originalMarker.y + (index % 2 ? shift.dy : 0))
      expect(adjustedMarker.width).toBeCloseTo(originalMarker.width)
      expect(adjustedMarker.height).toBeCloseTo(originalMarker.height)
    })
  })

  it('moves pages 1, 3, and 5 when the first page is a back', async () => {
    const input = await createPdf(Array.from({ length: 5 }, () => [200, 300]))
    const original = await PDFDocument.load(input)
    const result = await adjustDuplexPdf(input, { ...defaultOptions, firstPageIsFront: false })
    const adjusted = await PDFDocument.load(result.bytes)
    const shift = backShiftPt(defaultOptions.offsetXmm, defaultOptions.offsetYmm)

    expect(result.shiftedPages).toEqual([1, 3, 5])
    original.getPages().forEach((page, index) => {
      const delta = index % 2 === 0 ? shift : { dx: 0, dy: 0 }
      const before = marker(page)
      const after = marker(adjusted.getPages()[index]!)
      expect(after.x).toBeCloseTo(before.x + delta.dx)
      expect(after.y).toBeCloseTo(before.y + delta.dy)
    })
  })

  it('handles a one-page PDF and preserves page sizes with zero offsets', async () => {
    const input = await createPdf([[200, 300], [250, 350], [300, 400]])
    const original = await PDFDocument.load(input)
    const result = await adjustDuplexPdf(input, { offsetXmm: 0, offsetYmm: 0 })
    const adjusted = await PDFDocument.load(result.bytes)

    expect(result.pageCount).toBe(3)
    expect(result.shiftedPages).toEqual([])
    expect(adjusted.getPages().map((page) => page.getMediaBox())).toEqual(
      original.getPages().map((page) => page.getMediaBox()),
    )
    original.getPages().forEach((page, index) => {
      expect(marker(adjusted.getPages()[index]!).x).toBeCloseTo(marker(page).x)
      expect(marker(adjusted.getPages()[index]!).y).toBeCloseTo(marker(page).y)
    })

    const onePage = await adjustDuplexPdf(await createPdf([[200, 300]]), defaultOptions)
    expect(onePage.pageCount).toBe(1)
    expect(onePage.shiftedPages).toEqual([])
  })

  it('matches the back movement in the application PDF export', async () => {
    const card: Card = {
      id: 'calibration-check',
      bleedMode: 'IMAGE',
      frontProcessedSrc: pixel,
      backProcessedSrc: pixel,
      frontCrop: { x: 0, y: 0, width: 750, height: 1050 },
      backCrop: { x: 0, y: 0, width: 750, height: 1050 },
      frontBackground: { enabled: true, color: '#ffffff' },
      backBackground: { enabled: true, color: '#ffffff' },
      bleedColor: '#ffffff',
      quantity: 1,
    }
    const grid = calculateGrid({ paper: PAPER.LETTER, card: CARD_PRESETS.MINI })
    const renderSheet = (offsetX: number, offsetY: number) =>
      renderToBuffer(
        createElement(DuplexDoc, {
          cards: [card],
          paper: PAPER.LETTER,
          grid,
          cardSize: CARD_PRESETS.MINI,
          calibration: { offsetX, offsetY },
        }) as unknown as Parameters<typeof renderToBuffer>[0],
      )
    const calibratedX = mmToPt(defaultOptions.offsetXmm)
    const calibratedY = mmToPt(defaultOptions.offsetYmm)
    const original = await PDFDocument.load(await renderSheet(0, 0))
    const calibrated = await PDFDocument.load(await renderSheet(calibratedX, calibratedY))
    const adjusted = await PDFDocument.load(
      (await adjustDuplexPdf(await renderSheet(0, 0), defaultOptions)).bytes,
    )
    const originalBack = imageMarker(original.getPages()[1]!)
    const calibratedBack = imageMarker(calibrated.getPages()[1]!)
    const adjustedBack = imageMarker(adjusted.getPages()[1]!)
    const shift = backShiftPt(defaultOptions.offsetXmm, defaultOptions.offsetYmm)

    expect(calibratedBack.x - originalBack.x).toBeCloseTo(shift.dx)
    expect(calibratedBack.y - originalBack.y).toBeCloseTo(shift.dy)
    expect(adjustedBack.x).toBeCloseTo(calibratedBack.x)
    expect(adjustedBack.y).toBeCloseTo(calibratedBack.y)
  })

  it('reports an empty PDF', async () => {
    const document = await PDFDocument.create({ updateMetadata: false })
    const input = await document.save({ addDefaultPage: false })

    await expect(adjustDuplexPdf(input, defaultOptions)).rejects.toMatchObject({
      name: 'AdjustPdfError',
      code: 'EMPTY',
    })
  })

  it('rejects PDFs with annotations that cannot be preserved', async () => {
    const source = await PDFDocument.load(await createPdf([[200, 300]]))
    const annotation = source.context.obj({
      Type: 'Annot',
      Subtype: 'Text',
      Rect: [0, 0, 20, 20],
    })
    source.getPages()[0].node.addAnnot(source.context.register(annotation))

    await expect(adjustDuplexPdf(await source.save(), defaultOptions)).rejects.toMatchObject({
      name: 'AdjustPdfError',
      code: 'ANNOTATIONS_UNSUPPORTED',
    })
  })

  it('reports invalid, encrypted, rotated, and oversized PDFs', async () => {
    await expect(
      adjustDuplexPdf(new TextEncoder().encode('not a PDF'), defaultOptions),
    ).rejects.toMatchObject({ code: 'NOT_A_PDF' })

    await expect(
      adjustDuplexPdf(
        Uint8Array.from(atob(encryptedPdf), (character) => character.charCodeAt(0)),
        defaultOptions,
      ),
    ).rejects.toMatchObject({ code: 'ENCRYPTED_NEEDS_PASSWORD' })

    const rotated = await PDFDocument.create({ updateMetadata: false })
    rotated.addPage([200, 300]).setRotation(degrees(90))
    await expect(adjustDuplexPdf(await rotated.save(), defaultOptions)).rejects.toMatchObject({
      code: 'ROTATED_PAGES_UNSUPPORTED',
    })

    await expect(
      adjustDuplexPdf(new Uint8Array(150 * 1024 * 1024 + 1), defaultOptions),
    ).rejects.toMatchObject({ code: 'TOO_LARGE' })
  })
})
