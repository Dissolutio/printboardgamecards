import { renderToBuffer } from '@react-pdf/renderer'
import { describe, expect, it } from 'vitest'
import {
  calculateGrid,
  calculateTightGrid,
  CARD_PRESETS,
  PAPER,
} from '../lib/geometry.ts'
import type { Card } from '../types.ts'
import DuplexDoc from './DuplexDoc.tsx'
import PrintAndGlueDoc from './PrintAndGlueDoc.tsx'

const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII='
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
    bleedMode: index % 2 === 0 ? 'IMAGE' : 'COLOR',
    frontProcessedSrc: pixel,
    backProcessedSrc: distinctBacks[index],
    frontCrop: { x: 0, y: 0, width: 750, height: 1050 },
    backCrop: { x: 0, y: 0, width: 750, height: 1050 },
    frontBackgroundColor: '#ff0000',
    backBackgroundColor: '#0000ff',
    bleedColor: '#00ff00',
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

describe('PrintAndGlueDoc PDF rendering', () => {
  for (const { name, paper, expectedBox } of paperCases) {
    it(`renders four front/back pairs on ${name} pages at the paper dimensions`, async () => {
      const cards = makeCards(4)
      const cardSize = CARD_PRESETS.POKER
      const grid = calculateTightGrid({ paper, card: cardSize })
      const pdfBytes = await renderToBuffer(
        <PrintAndGlueDoc
          cards={cards}
          paper={paper}
          grid={grid}
          cardSize={cardSize}
        />,
      )
      const pdfText = new TextDecoder('latin1').decode(pdfBytes)
      const pageContent = (await inflatePdfStreams(pdfBytes)).join('\n')
      const mediaBoxes = pageMediaBoxes(pdfText)

      expect(mediaBoxes).toHaveLength(2)
      expect(mediaBoxes).toEqual([expectedBox, expectedBox])
      expect(pdfText).toContain('/Subtype /Image')
      expect(pageContent.match(/\/I\d+ Do/g)).toHaveLength(8)
      expect(pageContent).toContain('1 0 0 scn')
      expect(pageContent).toContain('0 0 1 scn')
      expect(pageContent).toContain('0 1 0 scn')
      expect(pageContent).toMatch(/\bre\nf\b/)
    })
  }

  it('renders a background-only back and omits a back with neither image nor background', async () => {
    const card: Card = {
      id: 'background-only-back',
      bleedMode: 'IMAGE',
      frontProcessedSrc: pixel,
      frontCrop: { x: 0, y: 0, width: 750, height: 1050 },
      frontBackgroundColor: '#ff0000',
      backBackgroundColor: '#0000ff',
      bleedColor: '#00ff00',
      quantity: 1,
    }
    const cardSize = CARD_PRESETS.POKER
    const grid = calculateTightGrid({ paper: PAPER.LETTER, card: cardSize })
    const withBackground = await renderToBuffer(
      <PrintAndGlueDoc
        cards={[card]}
        paper={PAPER.LETTER}
        grid={grid}
        cardSize={cardSize}
      />,
    )
    const coloredContent = (await inflatePdfStreams(withBackground)).join('\n')
    expect(coloredContent.match(/0 0 1 scn/g)).toHaveLength(1)

    const withoutBackground = await renderToBuffer(
      <PrintAndGlueDoc
        cards={[{ ...card, backBackgroundColor: undefined }]}
        paper={PAPER.LETTER}
        grid={grid}
        cardSize={cardSize}
      />,
    )
    const emptyBackContent = (await inflatePdfStreams(withoutBackground)).join('\n')
    expect(emptyBackContent.match(/0 0 1 scn/g) ?? []).toHaveLength(0)
  })
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
          calibration={{ offsetX: 0, offsetY: 0 }}
        />,
      )
      const pdfText = new TextDecoder('latin1').decode(pdfBytes)
      const pageContent = (await inflatePdfStreams(pdfBytes)).join('\n')
      const mediaBoxes = pageMediaBoxes(pdfText)

      expect(mediaBoxes).toHaveLength(4)
      expect(mediaBoxes).toEqual(Array.from({ length: 4 }, () => expectedBox))
      expect(pdfText).toContain('/Subtype /Image')
      expect(pageContent.match(/\/I\d+ Do/g)).toHaveLength(10)
      expect(pageContent).toContain('1 0 0 scn')
      expect(pageContent).toContain('0 0 1 scn')
      expect(pageContent).toMatch(/\bre\nf\b/)
    })
  }
})
