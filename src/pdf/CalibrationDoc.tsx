import { Document, Page, Text, View } from '@react-pdf/renderer'
import { applyCalibration, DEFAULT_BLEED, type Size } from '../lib/geometry.ts'
import type { Grid, Calibration } from '../lib/layout.ts'
import { calibrationMarks, type CalibrationMark } from '../lib/calibration.ts'

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

export default function CalibrationDoc({
  paper,
  cardSize,
  grid,
  calibration,
}: CalibrationDocProps) {
  const marks = calibrationMarks(grid, paper, calibration)
  const scaleBarWidth = (100 * 72) / 25.4
  const scaleBarLeft = (paper.width - scaleBarWidth) / 2
  const scaleBarY = 28
  const pages = [
    {
      side: 'front' as const,
      label: 'FRONT ▲',
      marks: marks.front,
    },
    {
      side: 'back' as const,
      label: 'BACK ▲',
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
            {side === 'front' && (
              <>
                <View
                  style={{
                    position: 'absolute',
                    left: scaleBarLeft,
                    top: scaleBarY,
                    width: scaleBarWidth,
                    height: 0.5,
                    backgroundColor: '#000000',
                  }}
                />
                {Array.from({ length: 11 }, (_, index) => (
                  <View
                    key={`tick-${index}`}
                    style={{
                      position: 'absolute',
                      left: scaleBarLeft + (scaleBarWidth * index) / 10 - 0.125,
                      top: scaleBarY - 3,
                      width: 0.25,
                      height: 6,
                      backgroundColor: '#000000',
                    }}
                  />
                ))}
                <Text
                  style={{
                    position: 'absolute',
                    left: scaleBarLeft,
                    top: scaleBarY + 5,
                    width: scaleBarWidth,
                    fontSize: 6,
                    color: '#000000',
                  }}
                >
                  100 mm - measure this to check printer scaling
                </Text>
              </>
            )}
          </View>
        </Page>
      ))}
    </Document>
  )
}
