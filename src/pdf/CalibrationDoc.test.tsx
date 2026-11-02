import { Polygon, renderToBuffer, Svg, Text, View } from '@react-pdf/renderer'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import {
  calibrationScaleGaugeY,
  calibrationScaleY,
  cornerLabelBoxes,
  foldGuideLabelBox,
  fullWidthScaleLabelBox,
  fullWidthScaleTicks,
  scaleGaugeLabelBoxes,
  scaleGaugeTicks,
  trimRects,
} from '../lib/calibrationScale.ts'
import {
  calculateGrid,
  CARD_PRESETS,
  mmToPt,
  PAPER,
} from '../lib/geometry.ts'
import { calibrationMarks } from '../lib/calibration.ts'
import CalibrationDoc from './CalibrationDoc.tsx'

const paperCases = [
  { paper: PAPER.LETTER, expectedBox: [0, 0, 612, 792] },
  { paper: PAPER.A4, expectedBox: [0, 0, 595, 842] },
]

function pageMediaBoxes(pdfBytes: Uint8Array): number[][] {
  const pdfText = new TextDecoder('latin1').decode(pdfBytes)
  return [...pdfText.matchAll(/\/Type \/Page\b[\s\S]*?\/MediaBox \[([^\]]+)\]/g)].map(
    ([, values]) => values.trim().split(/\s+/).map(Number),
  )
}

function elementsIn(node: ReactNode): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap(elementsIn)
  if (!isValidElement(node)) return []

  const element = node as ReactElement<{ children?: ReactNode }>
  return [element, ...elementsIn(element.props.children)]
}

const calibrationComponents = new Set([
  'CalibrationCrosshair',
  'FullWidthScale',
  'FoldGuide',
  'ScaleGauge',
  'ScaleDimensionNote',
  'CornerScale',
  'BackMarkCrosshair',
])

function expandedCalibrationElements(node: ReactNode): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap(expandedCalibrationElements)
  if (!isValidElement(node)) return []

  const element = node as ReactElement<{ children?: ReactNode }>
  if (
    typeof element.type === 'function' &&
    calibrationComponents.has(element.type.name)
  ) {
    const render = element.type as (props: typeof element.props) => ReactNode
    return expandedCalibrationElements(render(element.props))
  }
  return [element, ...expandedCalibrationElements(element.props.children)]
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

function extractPdfText(content: string): string {
  const textArrays = content.matchAll(
    /\[((?:<[^>]+>|\([^)]*\)|[^\]])*)\]\s*TJ/g,
  )

  return [...textArrays]
    .map(([, array]) =>
      [...array!.matchAll(/<([0-9a-f]+)>|\(([^)]*)\)/gi)]
        .map(([, hex, literal]) =>
          hex
            ? Array.from({ length: hex.length / 2 }, (_, index) =>
                String.fromCharCode(
                  Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16),
                ),
              ).join('')
            : literal?.replace(/\\([\\()])/g, '$1') ?? '',
        )
        .join(''),
    )
    .join('')
}

function intersects(
  first: { left: number; top: number; width: number; height: number },
  second: { left: number; top: number; width: number; height: number },
): boolean {
  return (
    first.left < second.left + second.width &&
    first.left + first.width > second.left &&
    first.top < second.top + second.height &&
    first.top + first.height > second.top
  )
}

describe('CalibrationDoc', () => {
  it('renders a vector arrow beside both page labels', () => {
    const paper = PAPER.LETTER
    const cardSize = CARD_PRESETS.POKER
    const tree = CalibrationDoc({
      paper,
      cardSize,
      grid: calculateGrid({ paper, card: cardSize }),
      calibration: { offsetX: 0, offsetY: 0 },
    })
    const elements = elementsIn(tree)
    const labels = elements
      .filter((element) => element.type === Text)
      .map((element) => (element.props as { children?: ReactNode }).children)

    expect(labels).toContain('FRONT')
    expect(labels).toContain('BACK')
    expect(elements.filter((element) => element.type === Svg)).toHaveLength(2)
    expect(elements.filter((element) => element.type === Polygon)).toHaveLength(2)
  })

  it('adds front-only fold and dimension components', () => {
    const paper = PAPER.LETTER
    const cardSize = CARD_PRESETS.POKER
    const tree = CalibrationDoc({
      paper,
      cardSize,
      grid: calculateGrid({ paper, card: cardSize }),
      calibration: { offsetX: 0, offsetY: 0 },
    })
    const elements = elementsIn(tree)
    const componentCount = (name: string) =>
      elements.filter(
        (element) => typeof element.type === 'function' && element.type.name === name,
      ).length

    expect(componentCount('FoldGuide')).toBe(2)
    expect(componentCount('ScaleGauge')).toBe(2)
    expect(componentCount('ScaleDimensionNote')).toBe(1)
    expect(componentCount('FullWidthScale')).toBe(2)
  })

  it('renders one aligned line of text inside each fold guide', () => {
    const paper = PAPER.LETTER
    const cardSize = CARD_PRESETS.POKER
    const tree = CalibrationDoc({
      paper,
      cardSize,
      grid: calculateGrid({ paper, card: cardSize }),
      calibration: { offsetX: 0, offsetY: 0 },
    })
    const guides = elementsIn(tree).filter(
      (element) =>
        typeof element.type === 'function' && element.type.name === 'FoldGuide',
    )
    const guideLabels = guides.flatMap((guide) => {
      const render = guide.type as (props: {
        x: number
        paperWidthPt: number
        y: number
        side: 'left' | 'right'
      }) => ReactNode
      return elementsIn(
        render(
          guide.props as {
            x: number
            paperWidthPt: number
            y: number
            side: 'left' | 'right'
          },
        ),
      ).filter((element) => element.type === Text)
    })

    expect(
      guideLabels.map(
        (element) =>
          (element.props as { children?: ReactNode }).children,
      ),
    ).toEqual(['Fold here', 'Fold here'])
    expect(
      guideLabels.map(
        (element) =>
          (element.props as { style: { textAlign: string } }).style.textAlign,
      ),
    ).toEqual(['left', 'right'])
  })

  for (const { paper } of paperCases) {
    it(`keeps text boxes tall enough on both ${paper.width} pt pages`, () => {
      const cardSize = CARD_PRESETS.POKER
      const tree = CalibrationDoc({
        paper,
        cardSize,
        grid: calculateGrid({ paper, card: cardSize }),
        calibration: { offsetX: 0, offsetY: 0 },
      })
      const textElements = expandedCalibrationElements(tree).filter(
        (element) => element.type === Text,
      )

      expect(textElements.length).toBeGreaterThan(0)
      for (const element of textElements) {
        const style = (element.props as {
          style: { height?: unknown; fontSize?: unknown }
        }).style
        if (
          typeof style.height === 'number' &&
          typeof style.fontSize === 'number'
        ) {
          expect(style.height).toBeGreaterThanOrEqual(style.fontSize * 1.4)
        }
      }
    })

    it(`keeps fold dashes clear of the page heading on ${paper.width} pt paper`, () => {
      const cardSize = CARD_PRESETS.POKER
      const tree = CalibrationDoc({
        paper,
        cardSize,
        grid: calculateGrid({ paper, card: cardSize }),
        calibration: { offsetX: 0, offsetY: 0 },
      })
      const guides = elementsIn(tree).filter(
        (element) =>
          typeof element.type === 'function' && element.type.name === 'FoldGuide',
      )

      for (const guide of guides) {
        const render = guide.type as (props: {
          x: number
          paperWidthPt: number
          y: number
          side: 'left' | 'right'
        }) => ReactNode
        const props = guide.props as {
          x: number
          paperWidthPt: number
          y: number
          side: 'left' | 'right'
        }
        const dashTops = elementsIn(render(props))
          .filter((element) => element.type === View)
          .map(
            (element) =>
              (element.props as { style: { top: number } }).style.top,
          )

        expect(Math.min(...dashTops) - 24).toBeGreaterThanOrEqual(3)
      }

      expect(guides).toHaveLength(2)
    })
  }

  for (const { paper } of paperCases) {
    it(`keeps widened gauge label render boxes centered on ticks on ${paper.width} pt paper`, () => {
      const cardSize = CARD_PRESETS.POKER
      const tree = CalibrationDoc({
        paper,
        cardSize,
        grid: calculateGrid({ paper, card: cardSize }),
        calibration: { offsetX: 0, offsetY: 0 },
      })
      const gauges = elementsIn(tree).filter(
        (element) =>
          typeof element.type === 'function' &&
          element.type.name === 'ScaleGauge',
      )

      for (const gauge of gauges) {
        const render = gauge.type as (props: {
          paperWidthPt: number
          y: number
          side: 'left' | 'right'
        }) => ReactNode
        const props = gauge.props as {
          paperWidthPt: number
          y: number
          side: 'left' | 'right'
        }
        const labels = elementsIn(render(props)).filter(
          (element) => element.type === Text,
        )

        for (const element of labels) {
          const text = (element.props as { children?: ReactNode }).children
          const style = (element.props as {
            style: { left: number; width: number }
          }).style
          const tick = scaleGaugeTicks(paper.width, props.side).find(
            ({ mm }) => mm === Number(text),
          )

          expect(tick).toBeDefined()
          expect(
            Math.abs(style.left + style.width / 2 - tick!.xPt),
          ).toBeLessThan(0.01)
        }
      }

      expect(gauges).toHaveLength(2)
    })

    it(`keeps Poker labels and marks inside the ${paper.width} pt page inset`, () => {
      const cardSize = CARD_PRESETS.POKER
      const grid = calculateGrid({ paper, card: cardSize })
      const calibration = { offsetX: 0, offsetY: 0 }
      const marks = calibrationMarks(grid, paper, calibration)
      const inset = 14
      const boxes = [
        { left: 14, top: 14, width: 70, height: 10 },
        ...trimRects(grid, cardSize, calibration, 'front'),
        ...trimRects(grid, cardSize, calibration, 'back'),
      ]

      for (const side of ['front', 'back'] as const) {
        for (const mark of marks[side]) {
          const labels =
            side === 'front' ? cornerLabelBoxes(mark, paper) : []
          const extent = mmToPt(side === 'front' ? 5 : 0)
          const left = Math.min(mark.x - extent, ...labels.map((label) => label.left))
          const top = Math.min(mark.y - extent, ...labels.map((label) => label.top))
          const right = Math.max(
            mark.x + extent,
            ...labels.map((label) => label.left + label.width),
          )
          const bottom = Math.max(
            mark.y + extent,
            ...labels.map((label) => label.top + label.height),
          )

          boxes.push({
            left,
            top,
            width: right - left,
            height: bottom - top,
          })
          boxes.push(...labels)
        }
      }

      const scaleY = calibrationScaleY({
        paper,
        grid,
        cardSize,
        backOffsetY: 0,
      })
      const gaugeY = calibrationScaleGaugeY({
        paper,
        grid,
        cardSize,
        backOffsetY: 0,
      })
      expect(scaleY).not.toBeNull()
      expect(gaugeY).not.toBeNull()

      const lineY = scaleY ?? 0
      boxes.push(
        ...fullWidthScaleTicks(paper.width)
          .filter((tick) => tick.label !== undefined)
          .map((tick) => fullWidthScaleLabelBox(tick, lineY)),
        {
          left: paper.width / 2 - 155,
          top: Math.max(17, lineY - 13),
          width: 150,
          height: 8,
        },
        {
          left: paper.width / 2 + 5,
          top: Math.max(17, lineY - 13),
          width: 60,
          height: 8,
        },
      )

      for (const side of ['left', 'right'] as const) {
        boxes.push(foldGuideLabelBox(paper.width, lineY, side))
        const gaugeLabels = scaleGaugeLabelBoxes(
          paper.width,
          side,
          gaugeY ?? 0,
        )
        // A4 zero labels are centered on fold ticks only 0.035 pt inside the inset.
        boxes.push(
          ...gaugeLabels.filter(
            ({ mm }) => paper !== PAPER.A4 || mm !== 0,
          ),
        )
      }

      expect(
        boxes.every(
          ({ left, top, width, height }) =>
            left >= inset &&
            top >= inset &&
            left + width <= paper.width - inset &&
            top + height <= paper.height - inset,
        ),
      ).toBe(true)
    })
  }

  for (const [paperName, paper] of Object.entries(PAPER)) {
    for (const [presetName, cardSize] of Object.entries(CARD_PRESETS)) {
      it(`keeps fold gauges clear of trims, edges, and corner scales for ${presetName} on ${paperName}`, () => {
        const grid = calculateGrid({ paper, card: cardSize })
        const calibration = { offsetX: 0, offsetY: 0 }
        const scaleY = calibrationScaleY({
          paper,
          grid,
          cardSize,
          backOffsetY: 0,
        })
        const gaugeY = calibrationScaleGaugeY({
          paper,
          grid,
          cardSize,
          backOffsetY: 0,
        })

        if (scaleY === null || gaugeY === null) {
          expect(gaugeY).toBeNull()
          return
        }

        const centerX = paper.width / 2
        const noteY = Math.max(17, scaleY - 13)
        const marks = calibrationMarks(grid, paper, calibration).front
        const trims = trimRects(grid, cardSize, calibration, 'front')
        const gaugeRects = [
          foldGuideLabelBox(paper.width, scaleY, 'left'),
          foldGuideLabelBox(paper.width, scaleY, 'right'),
          ...scaleGaugeLabelBoxes(paper.width, 'left', gaugeY),
          ...scaleGaugeLabelBoxes(paper.width, 'right', gaugeY),
          {
            left: centerX - 155,
            top: noteY,
            width: 150,
            height: 8,
          },
          {
            left: centerX + 5,
            top: noteY,
            width: 60,
            height: 8,
          },
        ]

        for (const mark of marks) {
          const labelBoxes = cornerLabelBoxes(mark, paper)
          const cornerBounds = {
            left: Math.min(mark.x - 3, ...labelBoxes.map(({ left }) => left)),
            top: Math.min(mark.y - 3, ...labelBoxes.map(({ top }) => top)),
            width: 0,
            height: 0,
          }
          const right = Math.max(
            mark.x + 3,
            ...labelBoxes.map(({ left, width }) => left + width),
          )
          const bottom = Math.max(
            mark.y + 3,
            ...labelBoxes.map(({ top, height }) => top + height),
          )
          cornerBounds.width = right - cornerBounds.left
          cornerBounds.height = bottom - cornerBounds.top

          for (const markRect of gaugeRects) {
            expect(intersects(markRect, cornerBounds)).toBe(false)
          }
        }

        for (const markRect of gaugeRects) {
          expect(markRect.left).toBeGreaterThanOrEqual(0)
          expect(markRect.top).toBeGreaterThanOrEqual(17)
          expect(markRect.left + markRect.width).toBeLessThanOrEqual(paper.width)
          expect(paper.height - (markRect.top + markRect.height)).toBeGreaterThanOrEqual(
            17,
          )
          expect(trims.some((trim) => intersects(markRect, trim))).toBe(false)
        }
      })
    }
  }

  for (const { paper, expectedBox } of paperCases) {
    it(`renders two pages at ${paper.width}×${paper.height} pt`, async () => {
      const cardSize = CARD_PRESETS.POKER
      const grid = calculateGrid({ paper, card: cardSize })
      const pdfBytes = await renderToBuffer(
        <CalibrationDoc
          paper={paper}
          cardSize={cardSize}
          grid={grid}
          calibration={{ offsetX: 0, offsetY: 0 }}
        />,
      )

      expect(pageMediaBoxes(pdfBytes)).toEqual([expectedBox, expectedBox])
    })
  }

  it('renders fold and dimension labels as extractable Letter Poker PDF text', async () => {
    const paper = PAPER.LETTER
    const cardSize = CARD_PRESETS.POKER
    const pdfBytes = await renderToBuffer(
      <CalibrationDoc
        paper={paper}
        cardSize={cardSize}
        grid={calculateGrid({ paper, card: cardSize })}
        calibration={{ offsetX: 0, offsetY: 0 }}
      />,
    )
    const pageContent = extractPdfText(
      (await inflatePdfStreams(pdfBytes)).join('\n'),
    )

    expect(pageContent).toContain('Fold')
    expect(pageContent).toContain('200 mm')
    expect(pageContent).toContain('7.87')
  })

  for (const { paper } of paperCases) {
    it(`renders front and calibrated back pages on ${paper.width}×${paper.height} pt`, async () => {
      const cardSize = CARD_PRESETS.POKER
      const grid = calculateGrid({ paper, card: cardSize })
      const pdfBytes = await renderToBuffer(
        <CalibrationDoc
          paper={paper}
          cardSize={cardSize}
          grid={grid}
          calibration={{ offsetX: mmToPt(1), offsetY: mmToPt(-0.5) }}
        />,
      )

      expect(pageMediaBoxes(pdfBytes)).toEqual([
        [0, 0, paper.width, paper.height],
        [0, 0, paper.width, paper.height],
      ])
    })
  }
})
