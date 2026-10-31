import { Fragment } from 'react'
import { Document, Page, Polygon, Svg, Text, View } from '@react-pdf/renderer'
import {
  applyCalibration,
  DEFAULT_BLEED,
  mmToPt,
  type Size,
} from '../lib/geometry.ts'
import type { Grid, Calibration } from '../lib/layout.ts'
import { calibrationMarks, type CalibrationMark } from '../lib/calibration.ts'
import {
  calibrationScaleGaugeY,
  cornerLabelBoxes,
  calibrationScaleY,
  cornerScaleTicks,
  foldGuideXs,
  fullWidthScaleTicks,
  fullWidthScaleTickLength,
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

type TrimRect = {
  left: number
  top: number
  width: number
  height: number
}

export function trimRects(
  grid: Grid,
  cardSize: Size,
  calibration: Calibration,
  side: 'front' | 'back',
): TrimRect[] {
  const rects: TrimRect[] = []

  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      const cellCol = side === 'front' ? col : grid.cols - 1 - col
      const cellOrigin = applyCalibration(
        {
          x: grid.originX + cellCol * grid.cellW,
          y: grid.originY + row * grid.cellH,
        },
        calibration,
      )[side]
      rects.push({
        left: cellOrigin.x + DEFAULT_BLEED,
        top: cellOrigin.y + DEFAULT_BLEED,
        width: cardSize.width,
        height: cardSize.height,
      })
    }
  }

  return rects
}

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
                  left: (tick.xPt ?? 0) - 13,
                  top: y + (Math.abs(tick.mm) === 100 ? 8 : 5),
                  width: 26,
                  height: 6,
                  fontSize: Math.abs(tick.mm) === 100 ? 5 : 6,
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
  y,
  side,
}: {
  x: number
  y: number
  side: 'left' | 'right'
}) {
  return (
    <>
      {Array.from({ length: 5 }, (_, index) => (
        <View
          key={`fold-dash-${side}-${index}`}
          style={{
            position: 'absolute',
            left: x - 0.15,
            top: y - 9 + index * 4,
            width: 0.3,
            height: 2.5,
            backgroundColor: '#000000',
          }}
        />
      ))}
      <Text
        style={{
          position: 'absolute',
          left: x - 14,
          top: y - 13,
          width: 28,
          height: 5,
          fontSize: 5,
          textAlign: 'center',
          color: '#000000',
        }}
      >
        Fold here
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
  return (
    <>
      {scaleGaugeTicks(paperWidthPt, side).map((tick) => {
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
            {tick.label !== undefined && (
              <Text
                style={{
                  position: 'absolute',
                  left: tick.xPt - 5,
                  top: y + 5,
                  width: 10,
                  height: 6,
                  fontSize: 5,
                  textAlign: 'center',
                  color: '#000000',
                }}
              >
                {tick.label}
              </Text>
            )}
          </Fragment>
        )
      })}
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
          height: 5,
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
          height: 5,
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
  const labels = cornerLabelBoxes(mark, paper)

  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: mark.x - halfLength,
          top: mark.y - 0.125,
          width: halfLength * 2,
          height: 0.25,
          backgroundColor: '#000000',
        }}
      />
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
            fontSize: 5,
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
                <FoldGuide x={foldXs.left} y={scaleY} side="left" />
                <FoldGuide x={foldXs.right} y={scaleY} side="right" />
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
                left: 10,
                top: 8,
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
