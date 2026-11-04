import { en } from '../i18n/en.ts'
import { mmToPt } from './geometry.ts'

export type AdjustPdfOptions = {
  offsetXmm: number
  offsetYmm: number
  firstPageIsFront?: boolean
}

export type AdjustPdfWarning = 'CONTENT_NEAR_EDGE'

export type AdjustPdfResult = {
  bytes: Uint8Array
  pageCount: number
  shiftedPages: number[]
  warnings: AdjustPdfWarning[]
}

export type AdjustPdfErrorCode =
  | 'NOT_A_PDF'
  | 'ENCRYPTED_NEEDS_PASSWORD'
  | 'EMPTY'
  | 'ROTATED_PAGES_UNSUPPORTED'
  | 'ANNOTATIONS_UNSUPPORTED'
  | 'TOO_LARGE'

const errorMessageKeys: Record<AdjustPdfErrorCode, keyof typeof en> = {
  NOT_A_PDF: 'adjustPdf.error.notAPdf',
  ENCRYPTED_NEEDS_PASSWORD: 'adjustPdf.error.encrypted',
  EMPTY: 'adjustPdf.error.empty',
  ROTATED_PAGES_UNSUPPORTED: 'adjustPdf.error.rotated',
  ANNOTATIONS_UNSUPPORTED: 'adjustPdf.error.annotations',
  TOO_LARGE: 'adjustPdf.error.tooLarge',
}

const maxInputSize = 150 * 1024 * 1024

export class AdjustPdfError extends Error {
  readonly code: AdjustPdfErrorCode

  constructor(code: AdjustPdfErrorCode) {
    const message = en[errorMessageKeys[code]]
    super(typeof message === 'string' ? message : '')
    this.name = 'AdjustPdfError'
    this.code = code
  }
}

export function backShiftPt(offsetXmm: number, offsetYmm: number): {
  dx: number
  dy: number
} {
  const dx = -mmToPt(offsetXmm)
  const dy = -mmToPt(offsetYmm)

  return {
    dx: dx === 0 ? 0 : dx,
    dy: dy === 0 ? 0 : dy,
  }
}

export async function adjustDuplexPdf(
  input: Uint8Array,
  options: AdjustPdfOptions,
): Promise<AdjustPdfResult> {
  if (input.byteLength > maxInputSize) {
    throw new AdjustPdfError('TOO_LARGE')
  }

  const { PDFDocument, EncryptedPDFError } = await import('@cantoo/pdf-lib')
  let source: Awaited<ReturnType<typeof PDFDocument.load>>

  try {
    source = await PDFDocument.load(input, { updateMetadata: false })
  } catch (error) {
    if (error instanceof EncryptedPDFError) {
      throw new AdjustPdfError('ENCRYPTED_NEEDS_PASSWORD')
    }
    throw new AdjustPdfError('NOT_A_PDF')
  }

  const sourcePages = source.getPages()
  if (sourcePages.length === 0) {
    throw new AdjustPdfError('EMPTY')
  }

  if (sourcePages.some((page) => page.getRotation().angle !== 0)) {
    throw new AdjustPdfError('ROTATED_PAGES_UNSUPPORTED')
  }
  if (sourcePages.some((page) => (page.node.Annots()?.size() ?? 0) > 0)) {
    throw new AdjustPdfError('ANNOTATIONS_UNSUPPORTED')
  }

  const output = await PDFDocument.create({ updateMetadata: false })
  const { dx, dy } = backShiftPt(options.offsetXmm, options.offsetYmm)
  const firstPageIsFront = options.firstPageIsFront ?? true
  const shiftedPages: number[] = []

  try {
    for (const [index, sourcePage] of sourcePages.entries()) {
      const mediaBox = sourcePage.getMediaBox()
      const page = output.addPage([mediaBox.width, mediaBox.height])
      page.setMediaBox(mediaBox.x, mediaBox.y, mediaBox.width, mediaBox.height)
      const cropBox = sourcePage.getCropBox()
      const bleedBox = sourcePage.getBleedBox()
      const trimBox = sourcePage.getTrimBox()
      const artBox = sourcePage.getArtBox()
      page.setCropBox(cropBox.x, cropBox.y, cropBox.width, cropBox.height)
      page.setBleedBox(bleedBox.x, bleedBox.y, bleedBox.width, bleedBox.height)
      page.setTrimBox(trimBox.x, trimBox.y, trimBox.width, trimBox.height)
      page.setArtBox(artBox.x, artBox.y, artBox.width, artBox.height)

      const isBack = (index % 2 === 1) === firstPageIsFront
      const pageDx = isBack ? dx : 0
      const pageDy = isBack ? dy : 0
      if (isBack && (pageDx !== 0 || pageDy !== 0)) {
        shiftedPages.push(index + 1)
      }

      if (sourcePage.node.Contents()) {
        const embeddedPage = await output.embedPage(sourcePage)
        page.drawPage(embeddedPage, {
          x: mediaBox.x + pageDx,
          y: mediaBox.y + pageDy,
          width: mediaBox.width,
          height: mediaBox.height,
        })
      }
    }

    return {
      bytes: await output.save(),
      pageCount: sourcePages.length,
      shiftedPages,
      warnings: [],
    }
  } catch (error) {
    if (error instanceof AdjustPdfError) throw error
    throw new AdjustPdfError('NOT_A_PDF')
  }
}
