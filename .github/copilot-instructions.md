# Copilot instructions for printboardgamecards

Browser app that prints board-game cards. Stack: Vite 8, React 19, TypeScript, @react-pdf/renderer, react-easy-crop, Vitest, Tailwind 4 + DaisyUI. All geometry in code is PostScript points (1 in = 72 pt); the UI shows mm where noted.

Before finishing any task run: `npm test -- --run`, `npm run lint`, `npm run build`. All three must pass. Put the test count in the PR description. Never claim something was verified unless you actually ran it.

## Rules
- TypeScript has `erasableSyntaxOnly`: no `enum`, no constructor parameter properties. Use union types and `as const`.
- `noUnusedLocals` and `noUnusedParameters` are on. Remove unused code.
- Geometry, layout, crop, calibration, and export logic lives in `src/lib` as pure functions with no React or react-pdf imports, with unit tests. Never hard-code grid yields; compute them.
- `DEFAULT_BLEED` (9 pt) is defined once in `src/lib/geometry.ts`. Import it; never repeat the number.
- Every PDF document wraps page content in a fixed-size View equal to the paper size, and has a test asserting each page's media box equals the paper size.
- The front print never moves. Calibration shifts only the back. Back placement mirrors by column (`cols - 1 - col`); never reverse arrays.
- Processed card images are transparent PNGs. Backgrounds are separate layers. Use `hasBackground(card, side)` and `pieceFills(card, side)` from `src/lib/piece.ts`; do not re-implement those rules.
- Do not add dependencies unless the task says so.
- Stay inside the files the task names. If you are blocked or unsure, stop and say so in the PR description instead of guessing.
- Do not merge. Open a pull request.
