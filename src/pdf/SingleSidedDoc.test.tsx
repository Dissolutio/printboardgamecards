import { renderToBuffer } from '@react-pdf/renderer'
import { describe, expect, it } from 'vitest'
import { calculateGrid, CARD_PRESETS, PAPER } from '../lib/geometry.ts'
import type { Card } from '../types.ts'
import DuplexDoc from './DuplexDoc.tsx'
import SingleSidedDoc from './SingleSidedDoc.tsx'

const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg=='
const distinctBacks = [
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGN4JiICAALyAQ91Qg2iAAAAAElFTkSuQmCC',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGMQOSECAAHkAPFPiolyAAAAAElFTkSuQmCC',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGMQEXkGAAFOAQ95QyO7AAAAAElFTkSuQmCC',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4sEUEAARQAbm/JeGGAAAAAElFTkSuQmCC',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPYIrIFAAL8AX1T9PoqAAAAAElFTkSuQmCC',
]

const paperCases = [
  { name: 'Letter', paper: PAPER.LETTER, expectedBox: [0, 0, 612, 792] },
  { name: 'A4', paper: PAPER.A4, expectedBox: [0, 0, 595, 842] },
]

function makeCards(count: number): Card[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `poker-${index + 1}`,
    frontProcessedSrc: pixel,
    backProcessedSrc: distinctBacks[index],
    frontCrop: { x: 0, y: 0, width: 750, height: 1050 },
    backCrop: { x: 0, y: 0, width: 750, height: 1050 },
    bleedColor: '#ffffff',
    quantity: 1,
  }))
}

async function inflatePdfStreams(bytes: Uint8Array): Promise<string[]> {
  const source = new TextDecoder('latin1').decode(bytes)
  const streamHeader = /\/Length\s+(\d+)\s*\/Filter\s*\/FlateDecode\s*>>\s*stream\r?\n/g
  const streams: string[] = []
  let match = streamHeader.exec(source)

  while (match) {
    const start = streamHeader.lastIndex
    const length = Number(match[1])
    const compressed = new Blob([bytes.slice(start, start + length)])
    const inflated = compressed.stream().pipeThrough(new DecompressionStream('deflate'))
    streams.push(await new Response(inflated).text())
    streamHeader.lastIndex = start + length
    match = streamHeader.exec(source)
  }

  return streams
}

function pageMediaBoxes(pdfText: string): number[][] {
  return [...pdfText.matchAll(/\/Type \/Page\b[\s\S]*?\/MediaBox \[([^\]]+)\]/g)].map(
    ([, values]) => values.trim().split(/\s+/).map(Number),
  )
}

describe('SingleSidedDoc PDF rendering', () => {
  for (const { name, paper, expectedBox } of paperCases) {
    it(`renders five cards with art and crop marks on ${name} pages`, async () => {
      const cards = makeCards(5)
      const cardSize = CARD_PRESETS.POKER
      const grid = calculateGrid({ paper, card: cardSize })
      const pdfBytes = await renderToBuffer(
        <SingleSidedDoc
          cards={cards}
          paper={paper}
          grid={grid}
          cardSize={cardSize}
          bleedMode="IMAGE"
        />,
      )
      const pdfText = new TextDecoder('latin1').decode(pdfBytes)
      const pageContent = (await inflatePdfStreams(pdfBytes)).join('\n')
      const mediaBoxes = pageMediaBoxes(pdfText)

      expect(mediaBoxes).toHaveLength(2)
      expect(mediaBoxes).toEqual([expectedBox, expectedBox])
      expect(pdfText).toContain('/Subtype /Image')
      expect(pageContent.match(/\/I\d+ Do/g)).toHaveLength(5)
      expect(pageContent).toMatch(/\bre\nf\b/)
    })
  }
})

describe('DuplexDoc PDF rendering', () => {
  for (const { name, paper, expectedBox } of paperCases) {
    it(`renders duplex artwork on every ${name} page at the paper dimensions`, async () => {
      const cards = makeCards(5)
      const cardSize = CARD_PRESETS.POKER
      const grid = calculateGrid({ paper, card: cardSize })
      const pdfBytes = await renderToBuffer(
        <DuplexDoc
          cards={cards}
          paper={paper}
          grid={grid}
          cardSize={cardSize}
          bleedMode="IMAGE"
          calibration={{ offsetX: 0, offsetY: 0 }}
        />,
      )
      const pdfText = new TextDecoder('latin1').decode(pdfBytes)
      const pageContent = (await inflatePdfStreams(pdfBytes)).join('\n')
      const mediaBoxes = pageMediaBoxes(pdfText)

      expect(mediaBoxes).toHaveLength(4)
      expect(mediaBoxes).toEqual(Array.from({ length: 4 }, () => expectedBox))
      expect(pdfText).toContain('/Subtype /Image')
      expect(pdfText.match(/\/Subtype \/Image/g)?.length).toBeGreaterThanOrEqual(6)
      expect(pageContent.match(/\/I\d+ Do/g)).toHaveLength(10)
      expect(pageContent).toMatch(/\bre\nf\b/)
    })
  }
})
