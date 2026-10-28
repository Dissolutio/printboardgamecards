# Printboard Game Cards

Printboard Game Cards is a browser app for preparing board-game cards from your images and exporting print-ready PDFs on Letter or A4 paper. You can crop each card side, set its bleed and background, and choose how many copies to print.

## Print modes

- **Single-sided (print, cut, glue):** Packs card fronts and available backs onto pages with 5 mm gaps between pieces. The layout can rotate cards when that orientation fits more pieces.
- **Double-sided hand-cut:** Prints aligned front and back pages for duplex printing, with crop marks and calibration adjustments.
- **Double-sided machine-cut:** Not implemented yet.

## Duplex calibration

Calibration adjusts the back only; the front stays fixed. Entered X and Y offsets are in millimeters and are saved in the browser's `localStorage`. The calibration sheet and on-screen instructions help measure and adjust duplex alignment.

## Sizes and units

Geometry and layout calculations use PostScript points (72 pt per inch). Measurements shown for calibration and the print-and-glue gaps are in millimeters. The available card presets are **Poker**, **Bridge**, **Mini**, and **Tarot**. Paper sizes are **Letter** and **A4**.

## Project layout

- `src/lib/` contains geometry, crop, calibration, layout, and cut-file logic as pure functions; unit tests are alongside the modules.
- `src/pdf/` contains the PDF documents and page, card-piece, and crop-mark components.
- `src/components/` contains the card editor and card-face UI.
- `src/App.tsx` assembles the app UI and connects editing, calibration, and PDF export.
- `src/types.ts` contains shared card and crop types.

The cut-file generators in `src/lib/` can produce SVG (`cutSvg.ts`), DXF (`cutDxf.ts`), and HPGL (`cutHpgl.ts`) output. They are not wired into the UI.

## Status

The code's duplex calibration convention is: positive X moves the back left, and positive Y moves the back down; the front does not move. This sign convention, real-printer scale and gaps, and cutting-machine output have **not** been verified by real printing or cutting.

## Development

Install dependencies with `npm install`, then use these scripts:

- `npm run dev` — start the development server
- `npm run build` — type-check and create a production build
- `npm test -- --run` — run unit tests
- `npm run lint` — check code style

## Checks

- `npm test -- --run` — run unit tests
- `npm run lint` — check code style
- `npm run build` — type check and production build
