import { Fragment } from 'react'
import { Document, Page, Text, View } from '@react-pdf/renderer'
import {
  applyCalibration,
  DEFAULT_BLEED,
  mmToPt,
  type Size,
} from '../lib/geometry.ts'
import type { Grid, Calibration } from '../lib/layout.ts'
import { calibrationMarks, type CalibrationMark } from '../lib/calibration.ts'
import {
  cornerLabelBoxes,
  cornerScaleTicks,
  fullWidthScaleTicks,
  scaleBandY,
  type ScaleTick,
} from '../lib/calibrationScale.ts'

type CalibrationDocProps = {
  paper: Size
  cardSize: Size
  grid: Grid
  calibration: Calibration
}

type TrimRect = {
  left: number
  top: number
  width: number
  height: number
}

function trimRects(
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
        const length = tick.kind === 'major' ? 8 : tick.kind === 'mid' ? 5 : 3

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
                  top: y + 5,
                  width: 26,
                  fontSize: 6,
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
          tick.mm === 0 ? 4 : tick.kind === 'mid' ? 2.5 : 1.5

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
  const scaleY = scaleBandY({
    paperHeightPt: paper.height,
    firstTrimTopPt: grid.originY + DEFAULT_BLEED,
    lastTrimBottomPt:
      grid.originY +
      (grid.rows - 1) * grid.cellH +
      DEFAULT_BLEED +
      cardSize.height,
    backOffsetY: calibration.offsetY,
  })
  const pages = [
    {
      side: 'front' as const,
      label: 'FRONT',
      marks: marks.front,
    },
    {
      side: 'back' as const,
      label: 'BACK',
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
            <Text
              style={{
                position: 'absolute',
                left: 10,
                top: 8,
                fontSize: 8,
                color: '#000000',
              }}
            >
              {label}
            </Text>
          </View>
        </Page>
      ))}
    </Document>
  )
}
