# UI design reference

The owner approved this design. The app should look and flow exactly like it.

- `screens/*.png` are the pictures to match. Each screen has a `-desktop` (1440 px) and `-mobile` (390 px) image.
- `mockups/*.dc.html` are the source markup. They use a template format (`<x-dc>`, `<sc-for>`) and do not open directly in a browser. Read them for exact spacing, sizes and colors.
- Copy in the mockups is final unless a ticket says otherwise. Follow `docs/ui-copy-guide.md`.

## Screens and flow

1. **Start** (`Main`): hero, "Standard 52-card deck" panel, other ways to start (one card, open project file, restore last project), four trust tiles.
2. **Workspace** (`Workspace`): top bar, summary strip, card grid, Print settings panel, Two-sided printing panel.
3. **Card editor** (`Editor`): a dialog over the workspace. Front and Back tabs.
4. **Print preview** (`Preview`): page strip, one page drawn like the PDF, "This print job" table.

Flow: Start -> Workspace. Select a card -> Editor dialog -> Done -> Workspace. "See the pages" -> Preview -> "Back to cards". The Start panel is a flow, not a section that stays open on the Workspace.

## Tokens

| Token | Value |
| --- | --- |
| Page background | `#10141c` |
| Panel | `#181e29` |
| Panel raised | `#1f2633` |
| Footer bar | `#141922` |
| Backdrop behind dialog | `#0a0d13` |
| Border | `#2c3547` |
| Text | `#e8ecf4` |
| Muted text | `#a3adc2` |
| Accent (primary button, text `#fff`) | `#7a5cff` |
| Accent outline and focus | `#8f7bff` |
| Link and big numbers | `#b9acff` |
| Success | `#4ade80` (dot), pill `#12372a` on `#7ee2a8` |
| Destructive text and border | `#ff7aa2`, `#5b2a3d` |
| Card paper in thumbnails | `#f6f4ee` |
| Font | IBM Plex Sans 400, 500, 600, 700, with `system-ui` fallback |
| Radii | buttons 8 px, tiles 10 px, panels 14 px, dialog 16 px |

Every tap target is at least 44 px high. Keep visible focus rings (`#8f7bff`).

## Phone layout (most users will be on a phone)

- Under about 700 px wide, every row of panels stacks to one column. Padding drops from 32 px to 16 px.
- Workspace: summary strip wraps. Print settings panel goes below the card grid. Card grid uses `repeat(auto-fill, minmax(88px, 1fr))`.
- Top bar: project name and save status on the first line, buttons wrap below. Nothing scrolls sideways at 390 px.
- Editor dialog: full screen sheet on phones (no outer margin, no rounded corners). Header, tabs and footer stay visible. The middle scrolls. Footer buttons wrap.
- Preview: the page strip becomes one horizontal scrolling row above the page, not a tall column. The page scales to the screen width.
- Verify at 390 px and 1440 px. `document.documentElement.scrollWidth` must equal the viewport width.

## Confirm before overwriting work

Use one reusable confirm dialog (not `window.confirm`). It has a title, a plain sentence saying what will be lost, a primary button naming the action ("Replace every back"), and Cancel. Cancel is focused first. Escape cancels.

Ask for confirmation before:

- "Use this back for every card" (and "Change every back").
- Making a new deck while cards exist.
- Opening a project file or restoring while the current deck has cards or unsaved changes.
- Discarding the saved last project.
- Deleting a card, deleting a printer profile, or removing an image that is used on more than one card.
- Any other action that changes or removes more than one card at once.

Do not ask for single-card edits. Those save as you work.

## Behavior notes

- Numbers on the summary strip and the "This print job" table come from the real layout functions (`calculateGrid`, `calculateTightGrid`), never typed in.
- The preview uses the same layout as the PDF.
- The project saves on this device as you work (IndexedDB). A "Saved on this device at 12:04" line shows the last save time.
- "Card orientation on the page" options: Auto, Portrait, Landscape. The hint says it changes the cards, not the paper.
