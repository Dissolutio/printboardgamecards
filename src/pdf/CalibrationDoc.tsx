import { Fragment } from 'react'
import { Document, Page, Polygon, Svg, Text, View } from '@react-pdf/renderer'
import {
  applyCalibration,
  mmToPt,
  type Size,
} from '../lib/geometry.ts'
import type { Grid, Calibration } from '../lib/layout.ts'
import { calibrationMarks, type CalibrationMark } from '../lib/calibration.ts'
import {
  calibrationScaleGaugeY,
  trimRects,
  cornerLabelBoxes,
  foldGuideLabelBox,
  fullWidthScaleLabelBox,
  calibrationScaleY,
  cornerScaleTicks,
  foldGuideXs,
  fullWidthScaleTicks,
  fullWidthScaleTickLength,
  scaleGaugeLabelBoxes,
  scaleGaugeTicks,
  type ScaleTick,
} from '../lib/calibrationScale.ts'

type CalibrationDocProps = {
  paper: Size
  cardSize: Size
  grid: Grid
  calibration: Calibration
}

const CALIBRATION_PAGE_LABELS = ['FRONT ▲', 'BACK ▲'] as const

function CalibrationCrosshair({ mark }: { mark: CalibrationMark }) {
  const size = 4

  return (
    <View
      style={{
        position: 'absolute',
        left: mark.x - 3,
        top: mark.y - 3,
        width: 6,
        height: 6,
      }}
    >
      <View
        style={{
          position: 'absolute',
          left: 1,
          top: 1,
          width: size,
          height: size,
          borderWidth: 0.25,
          borderColor: '#000000',
          borderRadius: mark.shape === 'circle' ? size / 2 : 0,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 2.875,
          width: 6,
          height: 0.25,
          backgroundColor: '#000000',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 2.875,
          top: 0,
          width: 0.25,
          height: 6,
          backgroundColor: '#000000',
        }}
      />
    </View>
  )
}

function FullWidthScale({
  paperWidthPt,
  y,
  side,
  calibration,
}: {
  paperWidthPt: number
  y: number
  side: 'front' | 'back'
  calibration: Calibration
}) {
  const ticks = fullWidthScaleTicks(paperWidthPt)
  const position = (tick: ScaleTick) => {
    const xPt = tick.xPt ?? 0
    return side === 'front'
      ? { x: xPt, y }
      : applyCalibration({ x: paperWidthPt - xPt, y }, calibration).back
  }
  const first = position(ticks[0])
  const last = position(ticks[ticks.length - 1])

  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: Math.min(first.x, last.x),
          top: first.y - 0.15,
          width: Math.abs(last.x - first.x),
          height: 0.3,
          backgroundColor: '#000000',
        }}
      />
      {ticks.map((tick) => {
        const point = position(tick)
        const length = fullWidthScaleTickLength(tick)

        return (
          <View
            key={`full-tick-${tick.mm}`}
            style={{
              position: 'absolute',
              left: point.x - 0.15,
              top: point.y - length / 2,
              width: 0.3,
              height: length,
              backgroundColor: '#000000',
            }}
          />
        )
      })}
      {side === 'front' &&
        ticks.map(
          (tick) =>
            tick.label !== undefined && (
              <Text
                key={`full-label-${tick.mm}`}
                style={{
                  position: 'absolute',
                  ...fullWidthScaleLabelBox(tick, y),
                  textAlign: 'center',
                  color: '#000000',
                }}
              >
                {tick.label}
              </Text>
            ),
        )}
    </>
  )
}

function FoldGuide({
  x,
  paper,
  grid,
  cardSize,
  calibration,
  y,
  gaugeY,
  side,
}: {
  x: number
  paper: Size
  grid: Grid
  cardSize: Size
  calibration: Calibration
  y: number
  gaugeY: number
  side: 'left' | 'right'
}) {
  const label = foldGuideLabelBox({
    paper,
    grid,
    cardSize,
    calibration,
    scaleY: y,
    gaugeY,
    side,
  })
  const endTickLength = fullWidthScaleTickLength({
    mm: side === 'left' ? -100 : 100,
    kind: 'major',
    xPt: x,
  })
  const lineTop = y - endTickLength / 2

  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: x - 0.25,
          top: lineTop,
          width: 0.5,
          height: paper.height - lineTop,
          backgroundColor: '#000000',
        }}
      />
      <Text
        style={{
          position: 'absolute',
          left: label.left,
          top: label.top,
          width: label.width,
          height: label.height,
          fontSize: label.fontSize,
          textAlign: label.textAlign,
          color: '#000000',
        }}
      >
        Fold edge of page to this line and crease along line.
      </Text>
    </>
  )
}

function ScaleGauge({
  paperWidthPt,
  y,
  side,
}: {
  paperWidthPt: number
  y: number
  side: 'left' | 'right'
}) {
  const ticks = scaleGaugeTicks(paperWidthPt, side)
  const labels = scaleGaugeLabelBoxes(paperWidthPt, side, y)

  return (
    <>
      {ticks.map((tick) => {
        const length = tick.kind === 'major' ? 8 : tick.kind === 'mid' ? 5 : 3

        return (
          <Fragment key={`gauge-tick-${side}-${tick.mm}`}>
            <View
              style={{
                position: 'absolute',
                left: tick.xPt - 0.15,
                top: y - length / 2,
                width: 0.3,
                height: length,
                backgroundColor: '#000000',
              }}
            />
          </Fragment>
        )
      })}
      {labels.map((label) => (
        <Text
          key={`gauge-label-${side}-${label.mm}`}
          style={{
            position: 'absolute',
            // Add width so floating-point glyph advances do not trigger react-pdf wrapping.
            left: label.left - 2,
            top: label.top,
            width: label.width + 4,
            height: label.height,
            fontSize: label.fontSize,
            textAlign: 'center',
            color: '#000000',
          }}
        >
          {label.text}
        </Text>
      ))}
    </>
  )
}

function ScaleDimensionNote({ paperWidthPt, y }: { paperWidthPt: number; y: number }) {
  const centerX = paperWidthPt / 2
  const noteY = Math.max(17, y - 13)

  return (
    <>
      <Text
        style={{
          position: 'absolute',
          left: centerX - 155,
          top: noteY,
          width: 150,
          height: 8,
          fontSize: 5,
          textAlign: 'right',
          color: '#000000',
        }}
      >
        200 mm between the two long end lines
      </Text>
      <Text
        style={{
          position: 'absolute',
          left: centerX + 5,
          top: noteY,
          width: 60,
          height: 8,
          fontSize: 5,
          textAlign: 'left',
          color: '#000000',
        }}
      >
        7.87 in
      </Text>
    </>
  )
}

function CornerScale({
  mark,
  paper,
}: {
  mark: CalibrationMark
  paper: Size
}) {
  const ticks = cornerScaleTicks()
  const halfLength = mmToPt(5)
  const foldXs = foldGuideXs(paper.width)
  const foldLines = [foldXs.left, foldXs.right].filter(
    (x) => x > mark.x - halfLength && x < mark.x + halfLength,
  )
  const labels = cornerLabelBoxes(mark, paper)
  const baselineSegments = foldLines.reduce(
    (segments, foldX) => {
      const current = segments.pop()!
      if (foldX - 0.25 > current.left) {
        segments.push({
          left: current.left,
          width: foldX - 0.25 - current.left,
        })
      }
      if (current.left + current.width > foldX + 0.25) {
        segments.push({
          left: foldX + 0.25,
          width: current.left + current.width - (foldX + 0.25),
        })
      }
      return segments
    },
    [{ left: mark.x - halfLength, width: halfLength * 2 }],
  )

  return (
    <>
      {baselineSegments.map((segment, index) => (
        <View
          key={`corner-scale-baseline-${mark.x}-${mark.y}-${index}`}
          style={{
            position: 'absolute',
            left: segment.left,
            top: mark.y - 0.125,
            width: segment.width,
            height: 0.25,
            backgroundColor: '#000000',
          }}
        />
      ))}
      <View
        style={{
          position: 'absolute',
          left: mark.x - 0.125,
          top: mark.y - halfLength,
          width: 0.25,
          height: halfLength * 2,
          backgroundColor: '#000000',
        }}
      />
      {ticks.map((tick) => {
        const offsetPt = tick.offsetPt ?? 0
        const length =
          tick.mm === 0 ? 6 : tick.kind === 'mid' ? 4 : 2
        const tickX = mark.x + offsetPt
        const crossesFoldLine = [foldXs.left, foldXs.right].some(
          (foldX) => Math.abs(foldX - tickX) < 0.375,
        )

        if (crossesFoldLine) return null

        return (
          <Fragment key={`corner-tick-${mark.x}-${mark.y}-${tick.mm}`}>
            <View
              style={{
                position: 'absolute',
                left: mark.x + offsetPt - 0.125,
                top: mark.y - length / 2,
                width: 0.25,
                height: length,
                backgroundColor: '#000000',
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: mark.x - length / 2,
                top: mark.y + offsetPt - 0.125,
                width: length,
                height: 0.25,
                backgroundColor: '#000000',
              }}
            />
          </Fragment>
        )
      })}
      {labels.map((label, index) => (
        <Text
          key={`corner-label-${mark.x}-${mark.y}-${label.axis}-${index}`}
          style={{
            position: 'absolute',
            left: label.left,
            top: label.top,
            width: label.width,
            height: label.height,
            fontSize: label.fontSize,
            textAlign: 'center',
            color: '#000000',
          }}
        >
          {label.text}
        </Text>
      ))}
    </>
  )
}

function BackMarkCrosshair({ mark }: { mark: CalibrationMark }) {
  const arm = mmToPt(6)

  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: mark.x - arm,
          top: mark.y - 0.125,
          width: arm * 2,
          height: 0.25,
          backgroundColor: '#000000',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: mark.x - 0.125,
          top: mark.y - arm,
          width: 0.25,
          height: arm * 2,
          backgroundColor: '#000000',
        }}
      />
    </>
  )
}

export default function CalibrationDoc({
  paper,
  cardSize,
  grid,
  calibration,
}: CalibrationDocProps) {
  const marks = calibrationMarks(grid, paper, calibration)
  const scaleY = calibrationScaleY({
    paper,
    grid,
    cardSize,
    backOffsetY: calibration.offsetY,
  })
  const gaugeY = calibrationScaleGaugeY({
    paper,
    grid,
    cardSize,
    backOffsetY: calibration.offsetY,
  })
  const foldXs = foldGuideXs(paper.width)
  const pages = [
    {
      side: 'front' as const,
      label: CALIBRATION_PAGE_LABELS[0],
      marks: marks.front,
    },
    {
      side: 'back' as const,
      label: CALIBRATION_PAGE_LABELS[1],
      marks: marks.back,
    },
  ]

  return (
    <Document>
      {pages.map(({ side, label, marks: pageMarks }) => (
        <Page key={side} size={[paper.width, paper.height]}>
          <View
            style={{
              position: 'relative',
              width: paper.width,
              height: paper.height,
            }}
          >
            {trimRects(grid, cardSize, calibration, side).map((rect, index) => (
              <View
                key={`trim-${index}`}
                style={{
                  position: 'absolute',
                  left: rect.left,
                  top: rect.top,
                  width: rect.width,
                  height: rect.height,
                  borderWidth: 0.25,
                  borderColor: '#000000',
                }}
              />
            ))}
            {scaleY !== null && (
              <FullWidthScale
                paperWidthPt={paper.width}
                y={scaleY}
                side={side}
                calibration={calibration}
              />
            )}
            {side === 'front' && scaleY !== null && (
              <ScaleDimensionNote paperWidthPt={paper.width} y={scaleY} />
            )}
            {side === 'front' && scaleY !== null && gaugeY !== null && (
              <>
                <FoldGuide
                  x={foldXs.left}
                  paper={paper}
                  grid={grid}
                  cardSize={cardSize}
                  calibration={calibration}
                  y={scaleY}
                  gaugeY={gaugeY}
                  side="left"
                />
                <FoldGuide
                  x={foldXs.right}
                  paper={paper}
                  grid={grid}
                  cardSize={cardSize}
                  calibration={calibration}
                  y={scaleY}
                  gaugeY={gaugeY}
                  side="right"
                />
                <ScaleGauge paperWidthPt={paper.width} y={gaugeY} side="left" />
                <ScaleGauge paperWidthPt={paper.width} y={gaugeY} side="right" />
              </>
            )}
            {side === 'back' &&
              pageMarks.map((mark, index) => (
                <BackMarkCrosshair key={`back-crosshair-${index}`} mark={mark} />
              ))}
            {side === 'front' &&
              pageMarks.map((mark, index) => (
                <CornerScale
                  key={`corner-scale-${index}`}
                  mark={mark}
                  paper={paper}
                />
              ))}
            {pageMarks.map((mark, index) => (
              <CalibrationCrosshair key={`mark-${index}`} mark={mark} />
            ))}
            <View
              style={{
                position: 'absolute',
                left: 14,
                top: 14,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 8, color: '#000000' }}>
                {label.endsWith(' ▲') ? label.slice(0, -2) : label}
              </Text>
              {label.endsWith(' ▲') && (
                <Svg
                  width={7}
                  height={6}
                  viewBox="0 0 7 6"
                  style={{ marginLeft: 2 }}
                >
                  <Polygon points="0,6 3.5,0 7,6" fill="#000000" />
                </Svg>
              )}
            </View>
          </View>
        </Page>
      ))}
    </Document>
  )
}
