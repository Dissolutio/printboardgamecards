# UI string inventory

This inventory records strings in the requested application, component, PDF, and HTML files, plus validation and exception messages that can be displayed by the application. Tests and README text are excluded. The count is the number of records in the table; identical source strings used at different locations are grouped when they have the same meaning. Locations use repository-relative paths.

## Summary

- **Total string records:** 158
- **Problem tags:** counts are recorded after the table in the tag summary.
- **Strings with parameters:** see the parameter list below.
- **Strings that need plural handling:** see the plural list below.
- **Places that format or display numbers:** see the number list below.
- **Text baked into an image or PDF:** `src/pdf/CalibrationDoc.tsx:112,117,196` writes three text strings into calibration PDFs: `FRONT ▲`, `BACK ▲`, and `100 mm - measure this to check printer scaling`. Other PDF components draw card artwork and vector marks without app-authored text. The inline favicon in `index.html:9` and `public/flip-on-long-edge.jpg` contain no readable text. PDF card artwork comes from user images and is not app copy.

### Strings with parameters

Each parameterized string is listed as `key (parameter: type)`. The table gives the exact source location and proposed text.

- Quantity controls: `quantityStepper.group.aria`, `quantityStepper.decrease.aria`, `quantityStepper.decrease.title`, `quantityStepper.increase.aria`, `quantityStepper.increase.title` (`cardLabel: string`); `card.copyCount.output` (`count: number`, at `App.tsx:91,93` and `deck.ts:31`).
- Card and paper labels: `app.printerName.promptDefault` (`printerNumber: number`); `app.paperSummary.text` (`paperName: string`, `paperWidth: number`, `paperHeight: number`); `app.cardPreset.option` (`presetName: string`); `app.cardOrientation.auto.option` (`orientation: string`, `cardCount: number`); `app.printerProfile.option` (`printerName: string`); `app.card.title` and `app.preview.card.title` (`cardNumber: number`); `app.card.thumbnail.alt` and `app.preview.card.alt` (`cardNumber: number`, `side: string`).
- Calibration and page totals: `app.calibration.observedX.hint` and `app.calibration.observedY.hint` (`distance: number`, `unit: string`); `app.calibration.measurement.hint` (`limit: number`, `unit: string`); `app.pageSummary.text` (`pageCount: number`, `pageKind: string`, `copyCount: number`); `app.export.calibrated.button` (`printerName: string`).
- Dynamic error strings: `app.cardPreset.update.errorWithDetails`, `app.bleedMode.change.errorWithDetails`, `app.project.loadError`, `app.project.save.error`, `app.export.pdf.error`, `app.export.calibration.error`, and `cardEditor.cropPreview.error` (`error: string`); `project.version.unsupported.error` (`projectVersion: number`); `project.card.invalid.error` and `project.card.duplicateId.error` (`cardNumber: number`); `project.cardSize.unknown.error` (`presetName: string`); `card.notFound.error` (`cardId: string`).
- Error display sites: `app.calibration.storage.status`, `app.export.error`, `app.error.message`, and `cardEditor.error.message` (`message: string`).
- Card editor and image descriptions: `cardEditor.side.heading`, `cardEditor.upload.label`, `cardEditor.workspace.aria`, `cardEditor.cropSource.alt`, `cardEditor.liveCrop.alt`, `cardFace.image.alt`, and `app.preview.side.label` (`side: string`); `cardEditor.dpi.value` (`dpi: number`); `cardEditor.zoom.step.aria`, `cardEditor.zoom.decrease.coarse.aria`, `cardEditor.zoom.in.fine.aria`, `cardEditor.zoom.out.fine.aria`, and `cardEditor.zoom.in.coarse.aria` (`step: number`); `cardEditor.zoom.value.aria` (`fineStep: number`, `coarseStep: number`); `cardEditor.zoom.controls.hint` (`coarseStep: number`, `fineStep: number`); `cardEditor.lowResolution.warning` (`minimumDpi: number`); `cardEditor.trimSize.hint` (`width: number`, `height: number`); `cardEditor.cropSize.hint` (`bleed: number`, `cropWidth: number`, `cropHeight: number`).
- `pdf.calibration.scaleLabel` (`length: number`, `unit: string`).

### Strings that need plural handling

- `src/lib/deck.ts:31`, used by `App.tsx:91,93`: `card.copyCount.output` needs complete messages for each `Intl.PluralRules` category supported by the active locale.
- `src/App.tsx:1132`: when Auto shows its result, the card count in `app.cardOrientation.auto.option` needs complete messages for each plural category.
- `src/App.tsx:1395-1396`: `app.pageSummary.text` currently changes `page`/`page pair` and appends `s` manually. Provide complete messages for each plural category and separately handle pages versus page pairs.
- `src/App.tsx:1396`: the total copy count also needs a plural-aware message.

### Places that format or display numbers

- `src/App.tsx:248-249,325-327,345` formats calibration offsets with `toFixed(2)`. `src/App.tsx:1056` displays paper dimensions; `src/components/CardEditor.tsx:620` displays trim dimensions; `src/components/CardEditor.tsx:293,674` formats DPI and crop dimensions.
- `src/components/CardEditor.tsx:203,209,393` formats zoom with `toFixed(2)`; `src/lib/zoom.ts:22` uses `toFixed(2)` for rounding and `:34` parses a zoom value with `Number`.
- `src/App.tsx:341,361,365,367-368` parses calibration text with `Number`. `src/components/CardEditor.tsx:457,631` parses control values with `Number`.
- Dynamic counts and identifiers: `src/App.tsx:392,1132,1345-1356,1395-1396,1505-1509,1526` formats printer and card numbers, card counts, page counts, and copy totals; `src/lib/deck.ts:31` formats the copy count. `src/lib/project.ts:106,185,205` and `src/lib/projectIo.ts:19` include numbers or names in validation errors.
- `src/App.tsx:1273,1290,1303`, `src/components/CardEditor.tsx:428,470-471,486-487,515-516,528-529,543-544,554,589`, and `src/pdf/CalibrationDoc.tsx:196` contain fixed numeric values in messages.
- Machine-readable export formatting, not UI copy: `src/lib/cutSvg.ts:31,40` uses `toFixed(2)` and `toFixed(4)`; `src/lib/cutDxf.ts:113,115` uses `toFixed(3)`.

## Inventory

In the `problems` column, `—` means no copy issue was identified for the current text. Errors include whether source tracing shows that their message reaches the UI.

| # | File and line | Kind | Current text exactly as written | Problems | Proposed text | Proposed key | Parameters | Plural |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `index.html:15` | title | `printboardgamecards` | — | `Printboard Game Cards` | `app.document.title` | none | no |
| 2 | `src/App.tsx:79` | aria | `` `${cardLabel} copy count` `` | concatenation, ambiguous-term | `Copy count for {cardLabel}` | `quantityStepper.group.aria` | `cardLabel: string` | no |
| 3 | `src/App.tsx:83` | aria | `` `Decrease ${cardLabel} copies` `` | concatenation | `Decrease copies of {cardLabel}` | `quantityStepper.decrease.aria` | `cardLabel: string` | no |
| 4 | `src/App.tsx:84` | title | `` `Decrease ${cardLabel} copies` `` | concatenation | `Decrease copies of {cardLabel}` | `quantityStepper.decrease.title` | `cardLabel: string` | no |
| 5 | `src/App.tsx:87` | button | `−` | symbol-as-grammar | `Decrease` | `quantityStepper.decrease.button` | none | no |
| 6 | `src/App.tsx:91` | aria | `quantityLabel(quantity)` | concatenation, plural-hack | `{count} copy` for the one category; separate complete messages for the other categories | `card.copyCount.output` | `count: number` | yes |
| 7 | `src/App.tsx:98` | aria | `` `Increase ${cardLabel} copies` `` | concatenation | `Increase copies of {cardLabel}` | `quantityStepper.increase.aria` | `cardLabel: string` | no |
| 8 | `src/App.tsx:99` | title | `` `Increase ${cardLabel} copies` `` | concatenation | `Increase copies of {cardLabel}` | `quantityStepper.increase.title` | `cardLabel: string` | no |
| 9 | `src/App.tsx:102` | button | `+` | symbol-as-grammar | `Increase` | `quantityStepper.increase.button` | none | no |
| 10 | `src/App.tsx:185` | error (reaches UI: yes) | `'Could not read image data.'` | — | `The image data could not be read. Try saving the project again.` | `app.project.imageRead.error` | none | no |
| 11 | `src/App.tsx:194,198` | error (reaches UI: yes) | `'Could not convert image data.'` | — | `The image data could not be converted. Try saving the project again.` | `app.project.imageConvert.error` | none | no |
| 12 | `src/App.tsx:206` | error (reaches UI: yes) | `'Could not read an image from the project file.'` | — | `The project image could not be read. Choose another project file.` | `app.project.imageLoad.error` | none | no |
| 13 | `src/App.tsx:319` | other | `'Calibration changes could not be saved; reloading may lose them.'` | — | `Calibration changes could not be saved. Saving this project file keeps them.` | `app.calibration.storage.warning` | none | no |
| 14 | `src/App.tsx:392` | other | `'New printer name'` | — | `Enter a name for the new printer.` | `app.printer.add.prompt` | none | no |
| 15 | `src/App.tsx:392` | other | `` `Printer ${printerProfiles.profiles.length + 1}` `` | concatenation | `Printer {printerNumber}` | `app.printerName.promptDefault` | `printerNumber: number` | no |
| 16 | `src/App.tsx:401` | other | `'Rename printer'` | fragment | `Enter a new name for this printer.` | `app.printer.rename.prompt` | none | no |
| 17 | `src/App.tsx:639` | error (reaches UI: yes) | `'The deck changed while updating the preset. Please try again.'` | — | `The deck changed while the card size was updating. Try again.` | `app.cardPreset.changed.error` | none | no |
| 18 | `src/App.tsx:658` | error (reaches UI: yes) | `` `Could not update the preset: ${error.message}` `` | concatenation, fragment | `The card size could not be updated. {error}` | `app.cardPreset.update.errorWithDetails` | `error: string` | no |
| 19 | `src/App.tsx:659` | error (reaches UI: yes) | `'Could not update the preset.'` | ambiguous-term | `The card size could not be updated. Try again.` | `app.cardPreset.update.error` | none | no |
| 20 | `src/App.tsx:703` | error (reaches UI: yes) | `'The card preset changed during mode conversion. Please try again.'` | ambiguous-term | `The card size changed while converting the bleed mode. Try again.` | `app.bleedMode.presetChanged.error` | none | no |
| 21 | `src/App.tsx:744` | error (reaches UI: yes) | `` `Could not change bleed mode: ${error.message}` `` | concatenation, fragment | `The bleed mode could not be changed. {error}` | `app.bleedMode.change.errorWithDetails` | `error: string` | no |
| 22 | `src/App.tsx:745` | error (reaches UI: yes) | `'Could not change bleed mode.'` | — | `The bleed mode could not be changed. Try again.` | `app.bleedMode.change.error` | none | no |
| 23 | `src/App.tsx:794` | error (reaches UI: yes) | `'Could not save the project. Please try again.'` | — | `The project could not be saved. Try again.` | `app.project.save.fallbackError` | none | no |
| 24 | `src/App.tsx:810` | error (reaches UI: yes) | `'Finish the current operation before loading a project.'` | idiom | `Wait for the current operation to finish. Then load the project.` | `app.project.load.blockedError` | none | no |
| 25 | `src/App.tsx:894` | error (reaches UI: yes) | `'The deck changed while loading the project. Please try again.'` | — | `The deck changed while the project was loading. Try loading it again.` | `app.project.loadChanged.error` | none | no |
| 26 | `src/App.tsx:915` | error (reaches UI: yes) | `'Could not load the project. Please try again.'` | — | `The project could not be loaded. Try again.` | `app.project.load.fallbackError` | none | no |
| 27 | `src/App.tsx:914` | error (reaches UI: yes) | `` `Could not load the project: ${error.message}` `` | concatenation, fragment | `The project could not be loaded. {error}` | `app.project.loadError` | `error: string` | no |
| 28 | `src/App.tsx:931,977` | error (reaches UI: yes) | `'Upload and crop a front image before exporting.'` | — | `Upload and crop a front image. Then download the file.` | `app.export.frontRequired.error` | none | no |
| 29 | `src/App.tsx:967,1009` | error (reaches UI: yes) | `error instanceof Error ? error.message : 'PDF export failed. Please try again.'` | fragment | `The PDF could not be created. Try again.` or a complete translated error message | `app.export.pdf.error` | `error: string` | no |
| 30 | `src/App.tsx:1035-1039` | error (reaches UI: yes) | `error instanceof Error ? error.message : 'Calibration sheet export failed. Please try again.'` | fragment | `The calibration sheet could not be created. Try again.` or a complete translated error message | `app.export.calibration.error` | `error: string` | no |
| 31 | `src/App.tsx:791-795` | error (reaches UI: yes) | `error instanceof Error ? error.message : 'Could not save the project. Please try again.'` | fragment | `The project could not be saved. Try again.` or a complete translated error message | `app.project.save.error` | `error: string` | no |
| 32 | `src/App.tsx:1051` | other | `Printboard Game Cards` | — | `Printboard Game Cards` | `app.brand.name` | none | no |
| 33 | `src/App.tsx:1053` | other | `Card deck editor` | — | `Card deck editor` | `app.header.title` | none | no |
| 34 | `src/App.tsx:1056` | other | `{paperName === 'LETTER' ? 'Letter' : 'A4'} paper · {paper.width} × {paper.height} pt` | symbol-as-grammar, hard-coded-number-format | `{paperName}. Paper width: {paperWidth} pt. Paper height: {paperHeight} pt.` | `app.paperSummary.text` | `paperName: string`, `paperWidth: number`, `paperHeight: number` | no |
| 35 | `src/App.tsx:1063` | label | `Card preset` | ambiguous-term | `Card size` | `app.cardPreset.label` | none | no |
| 36 | `src/App.tsx:1075` | option | `{name.charAt(0) + name.slice(1).toLowerCase()}` | concatenation, caps-emphasis | Localized preset label, for example `Poker` | `app.cardPreset.option` | `presetName: string` | no |
| 37 | `src/App.tsx:1081` | label | `Paper size` | — | `Paper size` | `app.paperSize.label` | none | no |
| 38 | `src/App.tsx:1095` | option | `{option === 'LETTER' ? 'Letter' : 'A4'}` | — | `Letter` or `A4`, translated as appropriate | `app.paperSize.option` | none | no |
| 39 | `src/App.tsx:1101` | label | `Print mode` | ambiguous-term | `Printing method` | `app.printingMethod.label` | none | no |
| 40 | `src/App.tsx:1112` | option | `Single-sided (print, cut, glue)` | ambiguous-term | `Print and glue` | `app.printMode.printAndGlue.option` | none | no |
| 41 | `src/App.tsx:1113` | option | `Double-sided hand-cut` | ambiguous-term, fragment | `Double-sided, cut by hand` | `app.printMode.doubleSidedHandCut.option` | none | no |
| 42 | `src/App.tsx:1118` | label | `Piece orientation` | ambiguous-term | `Card orientation` | `app.cardOrientation.label` | none | no |
| 43 | `src/App.tsx:1132` | option | `Auto` | ambiguous-term | `Auto ({orientation}, {cardCount} cards per page)` when showing the calculated result | `app.cardOrientation.auto.option` | `orientation: string`, `cardCount: number` | yes |
| 44 | `src/App.tsx:1133` | option | `Upright` | ambiguous-term | `Portrait` | `app.cardOrientation.portrait.option` | none | no |
| 45 | `src/App.tsx:1134` | option | `Rotated` | ambiguous-term | `Landscape` | `app.cardOrientation.landscape.option` | none | no |
| 46 | `src/App.tsx:1144` | label | `Calibration` | — | `Calibration` | `app.calibration.heading` | none | no |
| 47 | `src/App.tsx:1146` | hint | `1. Print the sheet at Actual Size (100%, no Fit to Page). 2. Flip the paper on its LONG edge and print page 2 on the back; the BACK arrow should end up at the top. 3. Hold the sheet up to a light. Look from the FRONT side. 4. Measure how far the square marks sit from the circle marks, and enter it below. 5. Press Apply correction, then print the sheet again to confirm.` | caps-emphasis, fragment, idiom, symbol-as-grammar | `Print the sheet at 100% scale. Turn it over along its long edge. Print page 2 on the back. Hold the sheet toward a light. Measure the distance between the square and circle marks. Enter the offset below. Apply the correction. Print the sheet again to check the result.` | `app.calibration.instructions` | none | no |
| 48 | `src/App.tsx:1152` | label | `Printer profile` | ambiguous-term | `Printer profile` | `app.printerProfile.label` | none | no |
| 49 | `src/App.tsx:1161` | option | `{profile.name}` | — | `{printerName}` | `app.printerProfile.option` | `printerName: string` | no |
| 50 | `src/App.tsx:1172` | button | `New printer` | fragment | `Add printer` | `app.printer.add.button` | none | no |
| 51 | `src/App.tsx:1180` | button | `Rename` | fragment | `Rename printer` | `app.printer.rename.button` | none | no |
| 52 | `src/App.tsx:1188,1384` | button | `Delete` | fragment | `Delete printer` at 1188; `Delete card` at 1384 | `app.printer.delete.button`, `app.card.delete.button` | none | no |
| 53 | `src/App.tsx:1194` | label | `Current X offset (mm)` | ambiguous-term | `Current horizontal offset` | `app.calibration.offsetX.label` | none | no |
| 54 | `src/App.tsx:1216` | label | `Current Y offset (mm)` | ambiguous-term | `Current vertical offset` | `app.calibration.offsetY.label` | none | no |
| 55 | `src/App.tsx:1245` | button | `Reset to 0` | hard-coded-number-format | `Reset offsets` | `app.calibration.reset.button` | none | no |
| 56 | `src/App.tsx:1253` | button | `{isExporting ? 'Preparing calibration sheet…' : 'Download calibration sheet'}` | fragment, symbol-as-grammar | `Preparing the calibration sheet.` / `Download calibration sheet` | `app.calibration.download.button` | none | no |
| 57 | `src/App.tsx:1258` | other | `Apply measured correction` | fragment | `Measured correction` | `app.calibration.measuredCorrection.legend` | none | no |
| 58 | `src/App.tsx:1261,1279` | label | `Looking from the front, the back marks appear` | fragment, concatenation | `From the front, the back marks are offset.` | `app.calibration.observedOffset.label` | none | no |
| 59 | `src/App.tsx:1268` | aria | `Observed horizontal offset in millimetres` | ambiguous-term | `Measured horizontal offset` | `app.calibration.observedX.aria` | none | no |
| 60 | `src/App.tsx:1273` | hint | `mm to the RIGHT of the front marks (negative = left)` | fragment, caps-emphasis, symbol-as-grammar | `The back marks are {distance} {unit} to the right of the front marks.` | `app.calibration.observedX.hint` | `distance: number`, `unit: string` | no |
| 61 | `src/App.tsx:1286` | aria | `Observed vertical offset in millimetres` | ambiguous-term | `Measured vertical offset` | `app.calibration.observedY.aria` | none | no |
| 62 | `src/App.tsx:1290` | hint | `mm LOWER (negative = higher)` | fragment, caps-emphasis, symbol-as-grammar | `The back marks are {distance} {unit} below the front marks.` | `app.calibration.observedY.hint` | `distance: number`, `unit: string` | no |
| 63 | `src/App.tsx:1298` | button | `Apply correction` | — | `Apply correction` | `app.calibration.apply.button` | none | no |
| 64 | `src/App.tsx:1303` | hint | `Measure at two opposite corners. If they differ by more than 0.5 mm, your printer is scaling or skewing the page; enter the average and tell us.` | idiom, concatenation, hard-coded-number-format, second-person-address-unclear | `Measure the offset at two opposite corners. If the measurements differ by more than {limit} {unit}, the printer may be scaling or skewing the page. Enter the average offset.` | `app.calibration.measurement.hint` | `limit: number`, `unit: string` | no |
| 65 | `src/App.tsx:1307` | other | `{calibrationStorageWarning}` | — | Display a complete translated status message | `app.calibration.storage.status` | `message: string` | no |
| 66 | `src/App.tsx:1315` | label | `Cards` | — | `Cards` | `app.cards.heading` | none | no |
| 67 | `src/App.tsx:1317` | button | `+ Add card` | symbol-as-grammar | `Add card` | `app.card.add.button` | none | no |
| 68 | `src/App.tsx:1350,1505` | other | `Card {index + 1}` | concatenation, hard-coded-number-format | `Card {cardNumber}` | `app.card.title`, `app.preview.card.title` | `cardNumber: number` | no |
| 69 | `src/App.tsx:1344,1525` | placeholder | `{side === 'front' ? 'No front' : 'No back'}` | fragment, ambiguous-term | `No front image` / `No back image` | `app.cardFace.missingSide.placeholder` | none | no |
| 70 | `src/App.tsx:1345` | alt | `` `Card ${index + 1} ${side} thumbnail` `` | concatenation, fragment | `{side} of card {cardNumber}` | `app.card.thumbnail.alt` | `cardNumber: number`, `side: string` | no |
| 71 | `src/App.tsx:1362` | hint | `Front crop required; this card will be skipped during export.` | fragment, ambiguous-term | `Crop the front image. This card will not appear in the export until you do.` | `app.card.frontCrop.warning` | none | no |
| 72 | `src/App.tsx:1368` | hint | `No back image or background; no back piece will be printed.` | fragment, ambiguous-term | `Add a back image or background color to print the back of this card.` | `app.card.backMissing.warning` | none | no |
| 73 | `src/App.tsx:1377` | button | `Duplicate` | fragment | `Duplicate card` | `app.card.duplicate.button` | none | no |
| 74 | `src/App.tsx:1395-1396` | other | `{pageCount} {exportMode === 'DUPLEX' ? 'page pair' : 'page'}{pageCount === 1 ? '' : 's'} · {totalCopies(cards)} total copies` | plural-hack, concatenation, symbol-as-grammar, hard-coded-number-format | Use complete messages for each locale plural category: `The export has {pageCount} page.` / `The export has {pageCount} pages.` For duplex output, use separate complete messages for `page pair` and `page pairs`. Show the copy total in a separate count-aware message. | `app.pageSummary.text` | `pageCount: number`, `pageKind: string`, `copyCount: number` | yes |
| 75 | `src/App.tsx:1405` | button | `{isExporting ? 'Preparing PDF…' : 'Download PDF'}` | fragment, symbol-as-grammar | `Preparing the PDF.` / `Download PDF` | `app.export.pdf.button` | none | no |
| 76 | `src/App.tsx:1415` | button | `{isExporting ? 'Preparing PDF…' : 'Download PDF (original, shareable)'}` | fragment, ambiguous-term, symbol-as-grammar | `Preparing the PDF.` / `Download original PDF` | `app.export.originalPdf.button` | none | no |
| 77 | `src/App.tsx:1427` | button | `Download calibrated for {activeProfile.name}` | ambiguous-term, fragment | `Download calibrated PDF for {printerName}` | `app.export.calibrated.button` | `printerName: string` | no |
| 78 | `src/App.tsx:1437` | button | `{isSavingProject ? 'Saving…' : 'Save project'}` | fragment, symbol-as-grammar | `Saving the project.` / `Save project file` | `app.project.save.button` | none | no |
| 79 | `src/App.tsx:1445` | button | `{isLoadingProject ? 'Loading...' : 'Load project'}` | fragment, symbol-as-grammar | `Loading the project.` / `Load project file` | `app.project.load.button` | none | no |
| 80 | `src/App.tsx:1458` | hint | `Calibrated files only work on the printer they were measured on. Share the original.` | ambiguous-term | `Use a calibrated PDF only with the printer used for calibration. Share the original PDF with others.` | `app.export.calibration.note` | none | no |
| 81 | `src/App.tsx:1463` | hint | `Print at Actual Size. Flip on Long Edge. If printing by hand: print page 1, reload the sheet flipped on its long edge, then print page 2.` | caps-emphasis, fragment, ambiguous-term | `Print at 100% scale. Turn the sheet over along its long edge. Print page 1. Turn the sheet over again. Print page 2.` | `app.print.duplex.hint` | none | no |
| 82 | `src/App.tsx:1464` | hint | `Print at Actual Size / 100% scale. Do not use Fit to Page.` | symbol-as-grammar, caps-emphasis, fragment | `Print at 100% scale. Do not scale the page to fit the paper.` | `app.print.printAndGlue.hint` | none | no |
| 83 | `src/App.tsx:1468` | error (reaches UI: yes) | `{exportError}` | — | Display a complete translated error message | `app.export.error` | `message: string` | no |
| 84 | `src/App.tsx:1475` | label | `Edit selected card` | — | `Edit selected card` | `app.cardEditor.heading` | none | no |
| 85 | `src/App.tsx:1492` | hint | `Add a card to start building your deck.` | idiom | `Add a card to create a deck.` | `app.cards.empty.action` | none | no |
| 86 | `src/App.tsx:1497` | label | `Print preview` | ambiguous-term | `Print preview` | `app.printPreview.heading` | none | no |
| 87 | `src/App.tsx:1499` | hint | `No cards in this deck.` | — | `This deck has no cards.` | `app.cards.empty.message` | none | no |
| 88 | `src/App.tsx:1518` | other | `{side}` rendered with `capitalize` | — | `{side}` using a localized side name | `app.preview.side.label` | `side: string` | no |
| 89 | `src/App.tsx:1526` | alt | `` `Card ${index + 1} ${side} print preview` `` | concatenation, fragment | `{side} of card {cardNumber}` | `app.preview.card.alt` | `cardNumber: number`, `side: string` | no |
| 90 | `src/App.tsx:1543-1547` | other | `Cut` + `icon by` + `Icons8` | fragment, concatenation | `Cut icon by Icons8.` | `app.footer.iconCredit` | none | no |
| 91 | `src/App.tsx:79,83-84,98-99` | aria | `` `${cardLabel} copy count`; `Decrease ${cardLabel} copies`; `Increase ${cardLabel} copies` `` | concatenation, ambiguous-term | Use a full message with `{cardLabel}` for each action. | `quantityStepper.labels` | `cardLabel: string` | no |
| 92 | `src/App.tsx:93` | other | `quantityLabel(quantity)` | concatenation, plural-hack | `{count} copy` for the one category; complete messages for every other plural category | `card.copyCount.output` | `count: number` | yes |
| 93 | `src/App.tsx:967,1009,1038` | error (reaches UI: yes) | `error instanceof Error ? error.message : 'PDF export failed. Please try again.'` / `error instanceof Error ? error.message : 'Calibration sheet export failed. Please try again.'` | fragment | Show a complete translated error message for the failure. | `app.export.error` | `error: string` | no |
| 94 | `src/App.tsx:256-259,1467-1468` | error (reaches UI: yes) | `errors[side]` / `{exportError}` | — | Display the corresponding complete translated error message. | `app.error.message` | `message: string` | no |
| 95 | `src/components/CardEditor.tsx:290` | other | `{side}` rendered with `capitalize` | — | `{side}` using the localized side name | `cardEditor.side.heading` | `side: string` | no |
| 96 | `src/components/CardEditor.tsx:293` | other | `{dpi.toFixed(0)} DPI` | hard-coded-number-format | `{dpi} DPI` | `cardEditor.dpi.value` | `dpi: number` | no |
| 97 | `src/components/CardEditor.tsx:306` | label | `Background` | — | `Background` | `cardEditor.background.label` | none | no |
| 98 | `src/components/CardEditor.tsx:310` | label | `Background color` | — | `Background color` | `cardEditor.backgroundColor.label` | none | no |
| 99 | `src/components/CardEditor.tsx:323` | label | `Upload {side} image` | concatenation | `Upload the {side} image` | `cardEditor.upload.label` | `side: string` | no |
| 100 | `src/components/CardEditor.tsx:345` | button | `Remove image` | — | `Remove image` | `cardEditor.image.remove.button` | none | no |
| 101 | `src/components/CardEditor.tsx:364` | aria | `` `${side} image crop workspace. Arrow keys pan, plus and minus zoom.` `` | concatenation, symbol-as-grammar | `Crop the {side} image. Use the arrow keys to move it. Use plus and minus to change zoom.` | `cardEditor.workspace.aria` | `side: string` | no |
| 102 | `src/components/CardEditor.tsx:383` | alt | `` `${side} crop source` `` | concatenation, fragment | `Original {side} image` | `cardEditor.cropSource.alt` | `side: string` | no |
| 103 | `src/components/CardEditor.tsx:385` | error (reaches UI: yes) | `'This image could not be loaded. Try another file.'` | — | `The image could not be loaded. Choose another image file.` | `cardEditor.imageLoad.error` | none | no |
| 104 | `src/components/CardEditor.tsx:428` | hint | `Click the image, then use your keyboard: arrow keys nudge the image (hold Shift for 10x). The + and - keys zoom by 0.1 (hold Shift for 0.01).` | idiom, symbol-as-grammar, hard-coded-number-format | `Select the image. Use the arrow keys to move it. Hold Shift to move it farther. Use plus or minus to change zoom.` | `cardEditor.keyboard.hint` | none | no |
| 105 | `src/components/CardEditor.tsx:438` | button | `Fill` | ambiguous-term | `Fill` | `cardEditor.crop.fill.button` | none | no |
| 106 | `src/components/CardEditor.tsx:446` | button | `Fit` | ambiguous-term | `Fit` | `cardEditor.crop.fit.button` | none | no |
| 107 | `src/components/CardEditor.tsx:449` | label | `Zoom` | — | `Zoom` | `cardEditor.zoom.label` | none | no |
| 108 | `src/components/CardEditor.tsx:461-462` | aria | `Zoom. Left/Right arrow keys: 0.01.` | fragment, symbol-as-grammar, hard-coded-number-format | `Use the left and right arrow keys to change zoom by {step}.` | `cardEditor.zoom.step.aria` | `step: number` | no |
| 109 | `src/components/CardEditor.tsx:470-471` | aria | `Zoom out by 0.1` | fragment, hard-coded-number-format | `Decrease zoom by {step}.` | `cardEditor.zoom.decrease.coarse.aria` | `step: number` | no |
| 110 | `src/components/CardEditor.tsx:477` | button | `−` | symbol-as-grammar | `Decrease zoom` | `cardEditor.zoom.decrease.coarse.button` | none | no |
| 111 | `src/components/CardEditor.tsx:486-487` | aria | `Type an exact zoom value. Up/Down keys: 0.01 (Shift: 0.1).` | fragment, symbol-as-grammar, hard-coded-number-format | `Enter a zoom value. Use the up and down arrow keys to change it by {fineStep}. Hold Shift to use {coarseStep}.` | `cardEditor.zoom.value.aria` | `fineStep: number`, `coarseStep: number` | no |
| 112 | `src/components/CardEditor.tsx:515-516` | aria | `Zoom in by 0.01` | fragment, hard-coded-number-format | `Increase zoom by {step}.` | `cardEditor.zoom.in.fine.aria` | `step: number` | no |
| 113 | `src/components/CardEditor.tsx:523` | button | `▲` | symbol-as-grammar | `Increase zoom` | `cardEditor.zoom.in.fine.button` | none | no |
| 114 | `src/components/CardEditor.tsx:528-529` | aria | `Zoom out by 0.01` | fragment, hard-coded-number-format | `Decrease zoom by {step}.` | `cardEditor.zoom.out.fine.aria` | `step: number` | no |
| 115 | `src/components/CardEditor.tsx:536` | button | `▼` | symbol-as-grammar | `Decrease zoom` | `cardEditor.zoom.out.fine.button` | none | no |
| 116 | `src/components/CardEditor.tsx:543-544` | aria | `Zoom in by 0.1` | fragment, hard-coded-number-format | `Increase zoom by {step}.` | `cardEditor.zoom.in.coarse.aria` | `step: number` | no |
| 117 | `src/components/CardEditor.tsx:550` | button | `+` | symbol-as-grammar | `Increase zoom` | `cardEditor.zoom.in.coarse.button` | none | no |
| 118 | `src/components/CardEditor.tsx:554` | hint | `- / + : 0.1 steps   ▲ / ▼ : 0.01 steps (fine)` | fragment, symbol-as-grammar, hard-coded-number-format | `Use minus or plus to change zoom by {coarseStep}. Use the arrows to change it by {fineStep}.` | `cardEditor.zoom.controls.hint` | `coarseStep: number`, `fineStep: number` | no |
| 119 | `src/components/CardEditor.tsx:561` | other | `Live result` | fragment | `Crop preview` | `cardEditor.cropPreview.heading` | none | no |
| 120 | `src/components/CardEditor.tsx:569,582` | placeholder | `{side === 'front' ? 'Crop required' : 'No back'}` | fragment, ambiguous-term | `Crop the front image` / `No back image` | `cardEditor.crop.placeholder` | none | no |
| 121 | `src/components/CardEditor.tsx:570` | alt | `` `${side} live crop result` `` | concatenation, fragment | `Cropped {side} image preview` | `cardEditor.liveCrop.alt` | `side: string` | no |
| 122 | `src/components/CardEditor.tsx:589` | hint | `This crop is below 200 DPI and may print blurry.` | hard-coded-number-format, idiom | `The crop resolution is below {minimumDpi} DPI. The printed image may look blurred.` | `cardEditor.lowResolution.warning` | `minimumDpi: number` | no |
| 123 | `src/components/CardEditor.tsx:594` | error (reaches UI: yes) | `{error}` | — | Display a complete translated error message | `cardEditor.error.message` | `message: string` | no |
| 124 | `src/components/CardEditor.tsx:620` | hint | `Card size: {cardSize.width} × {cardSize.height} pt trim` | fragment, symbol-as-grammar, hard-coded-number-format | `Trim width: {width} pt. Trim height: {height} pt.` | `cardEditor.trimSize.hint` | `width: number`, `height: number` | no |
| 125 | `src/components/CardEditor.tsx:623` | label | `Copies of this card` | — | `Copies` | `cardEditor.copies.label` | none | no |
| 126 | `src/components/CardEditor.tsx:640` | other | `Bleed mode for this card` | ambiguous-term | `Bleed method` | `cardEditor.bleedMode.legend` | none | no |
| 127 | `src/components/CardEditor.tsx:648` | button | `Extend image` | ambiguous-term | `Extend the image into the bleed area` | `cardEditor.bleedMode.extendImage.button` | none | no |
| 128 | `src/components/CardEditor.tsx:656` | button | `Solid color` | ambiguous-term | `Use a solid color` | `cardEditor.bleedMode.solidColor.button` | none | no |
| 129 | `src/components/CardEditor.tsx:662` | label | `Bleed color` | — | `Bleed color` | `cardEditor.bleedColor.label` | none | no |
| 130 | `src/components/CardEditor.tsx:674` | hint | `{DEFAULT_BLEED} pt bleed · Crop area {area.width} × {area.height} pt` | symbol-as-grammar, hard-coded-number-format, fragment | `Bleed: {bleed} pt. Crop width: {cropWidth} pt. Crop height: {cropHeight} pt.` | `cardEditor.cropSize.hint` | `bleed: number`, `cropWidth: number`, `cropHeight: number` | no |
| 131 | `src/components/CardFace.tsx:66` | alt | `` `${side} card` `` | concatenation, fragment | `{side} of the card` | `cardFace.image.alt` | `side: string` | no |
| 132 | `src/components/CardFace.tsx:71` | placeholder | `side === 'front' ? 'Crop required' : 'No back'` | fragment, ambiguous-term | `Crop the front image` / `No back image` | `cardFace.placeholder` | none | no |
| 133 | `src/lib/deck.ts:31` | other | `` `${quantity} ${quantity === 1 ? 'copy' : 'copies'}` `` | concatenation, plural-hack | `{count} copy` for the one category; complete translated messages for every other category | `card.copyCount.output` | `count: number` | yes |
| 134 | `src/lib/project.ts:175` | error (reaches UI: yes) | `'Invalid project JSON.'` | — | `The project file is not valid JSON.` | `project.json.invalid.error` | none | no |
| 135 | `src/lib/project.ts:179` | error (reaches UI: yes) | `'Invalid project: expected an object.'` | ambiguous-term | `The project file has an invalid structure.` | `project.structure.invalid.error` | none | no |
| 136 | `src/lib/project.ts:182` | error (reaches UI: yes) | `'This project was made by a newer version of the app.'` | — | `This project file needs a newer version of the app.` | `project.version.newer.error` | none | no |
| 137 | `src/lib/project.ts:185` | error (reaches UI: yes) | `` `Unsupported project version: expected ${PROJECT_VERSION}.` `` | concatenation, ambiguous-term | `This project file version is not supported. The required version is {projectVersion}.` | `project.version.unsupported.error` | `projectVersion: number` | no |
| 138 | `src/lib/project.ts:85,191` | error (reaches UI: yes) | `'Invalid project settings.'` | — | `The project settings are invalid.` | `project.settings.invalid.error` | none | no |
| 139 | `src/lib/project.ts:87` | error (reaches UI: yes) | `'Invalid project settings.presetName: expected a string.'` | abbreviation, ambiguous-term | `The project card size setting must be text.` | `project.settings.cardSize.invalid.error` | none | no |
| 140 | `src/lib/project.ts:90` | error (reaches UI: yes) | `'Invalid project settings.paperName: expected LETTER or A4.'` | abbreviation, caps-emphasis, ambiguous-term | `The project paper size must be Letter or A4.` | `project.settings.paperSize.invalid.error` | none | no |
| 141 | `src/lib/project.ts:93` | error (reaches UI: yes) | `'Invalid project settings.exportMode: expected PRINT_GLUE or DUPLEX.'` | abbreviation, caps-emphasis, ambiguous-term | `The project printing method is not supported.` | `project.settings.printMode.invalid.error` | none | no |
| 142 | `src/lib/project.ts:100` | error (reaches UI: yes) | `'Invalid project settings.pieceOrientation: expected AUTO, UPRIGHT, or ROTATED.'` | abbreviation, caps-emphasis, ambiguous-term | `The project card orientation is not supported.` | `project.settings.cardOrientation.invalid.error` | none | no |
| 143 | `src/lib/project.ts:194` | error (reaches UI: yes) | `'Invalid project cards: expected an array.'` | ambiguous-term | `The card list in the project file is invalid.` | `project.cards.invalid.error` | none | no |
| 144 | `src/lib/project.ts:106-137` | error (reaches UI: yes) | `const prefix = \`Invalid project card ${index + 1}\``; `` `${prefix}: expected an object.` ``; `` `${prefix}.id: expected a non-empty string.` ``; `` `${prefix}.bleedMode: expected IMAGE or COLOR.` ``; `` `${prefix}.frontBackground: expected enabled and a valid color.` ``; `` `${prefix}.backBackground: expected enabled and a valid color.` ``; `` `${prefix}.bleedColor: expected a color in #rgb or #rrggbb format.` ``; `` `${prefix}.frontSrc: expected a string.` ``; `` `${prefix}.backSrc: expected a string.` ``; `` `${prefix}.frontCrop: expected finite crop values and positive width and height.` ``; `` `${prefix}.backCrop: expected finite crop values and positive width and height.` ``; `` `${prefix}.quantity: expected an integer.` `` | concatenation, abbreviation, ambiguous-term | `Card {cardNumber} must be an object.`; `Card {cardNumber} must have an identifier.`; `Card {cardNumber} has an unsupported bleed method.`; `The front background for card {cardNumber} must include a valid color.`; `The back background for card {cardNumber} must include a valid color.`; `Card {cardNumber} has an invalid bleed color.`; `The front image data for card {cardNumber} is invalid.`; `The back image data for card {cardNumber} is invalid.`; `The front crop for card {cardNumber} must have valid coordinates and positive width and height.`; `The back crop for card {cardNumber} must have valid coordinates and positive width and height.`; `The copy count for card {cardNumber} must be a whole number.` | `project.card.invalid.object`, `.identifier`, `.bleedMode`, `.frontBackground`, `.backBackground`, `.bleedColor`, `.frontImage`, `.backImage`, `.frontCrop`, `.backCrop`, `.quantity` | `cardNumber: number` | no |
| 145 | `src/lib/project.ts:205` | error (reaches UI: yes) | `` `Invalid project card ${index + 1}.id: duplicate id "${card.id}".` `` | concatenation, ambiguous-term | `Card {cardNumber} has a duplicate identifier.` | `project.card.duplicateId.error` | `cardNumber: number` | no |
| 146 | `src/lib/projectIo.ts:19` | error (reaches UI: yes) | `` `Unknown card preset "${settings.presetName}".` `` | concatenation, ambiguous-term | `The card size "{presetName}" is not supported.` | `project.cardSize.unknown.error` | `presetName: string` | no |
| 147 | `src/lib/zoom.ts:18` | error (reaches UI: unknown) | `'Zoom and zoom bounds must be finite, with min <= max.'` | abbreviation, symbol-as-grammar | `Zoom and its limits must be finite numbers. The minimum must not exceed the maximum.` | `crop.zoom.invalid.error` | none | no |
| 148 | `src/lib/layout.ts:38,96` | error (reaches UI: yes) | `'The grid must contain at least one cell.'` | ambiguous-term | `The selected paper size cannot fit a card. Choose a larger paper size or a smaller card size.` | `layout.noCardFits.error` | none | no |
| 149 | `src/lib/geometry.ts:95` | error (reaches UI: unknown) | `'Grid gap and margin must be non-negative.'` | ambiguous-term | `The card spacing and page margins must be zero or greater.` | `layout.spacing.invalid.error` | none | no |
| 150 | `src/lib/renderCrop.ts:9,17,34,60` | error (reaches UI: yes) | `'Could not load the image for cropping.'`; `'The image has invalid dimensions.'`; `'Could not prepare the crop canvas.'`; `'Could not create the cropped image.'` | ambiguous-term, fragment | `The image could not be loaded for cropping.`; `The image dimensions are invalid.`; `The crop could not be prepared.`; `The cropped image could not be created.` | `crop.imageLoad.error`, `crop.imageDimensions.error`, `crop.prepare.error`, `crop.create.error` | none | no |
| 151 | `src/lib/cropConvert.ts:33,47` | error (reaches UI: yes) | `'Image dimensions must be positive.'`; `'Crop must have a positive area.'` | ambiguous-term | `The image width and height must be greater than zero.`; `The crop width and height must be greater than zero.` | `crop.dimensions.invalid.error`, `crop.area.invalid.error` | none | no |
| 152 | `src/lib/deck.ts:9` | error (reaches UI: unknown) | `` `Card not found: ${cardId}` `` | concatenation, fragment | `Card {cardId} could not be found.` | `card.notFound.error` | `cardId: string` | no |
| 153 | `src/components/CardEditor.tsx:160-167` | error (reaches UI: yes) | `renderError instanceof Error ? renderError.message : 'Could not create the crop preview.'` | fragment | `The crop preview could not be created. {error}` | `cardEditor.cropPreview.error` | `error: string` | no |
| 154 | `src/pdf/CalibrationDoc.tsx:112` | pdf | `'FRONT ▲'` | caps-emphasis, symbol-as-grammar | `1` | `pdf.calibration.frontPageLabel` | none | no |
| 155 | `src/pdf/CalibrationDoc.tsx:117` | pdf | `'BACK ▲'` | caps-emphasis, symbol-as-grammar | `2` | `pdf.calibration.backPageLabel` | none | no |
| 156 | `src/pdf/CalibrationDoc.tsx:196` | pdf | `100 mm - measure this to check printer scaling` | hard-coded-number-format, fragment | `100 mm` | `pdf.calibration.scaleLabel` | `length: number`, `unit: string` | no |
| 157 | `src/components/CardEditor.tsx:166` | error (reaches UI: yes) | `'Could not create the crop preview.'` | — | `The crop preview could not be created. Try moving or resizing the crop.` | `cardEditor.cropPreview.error` | none | no |
| 158 | `src/App.tsx:515` | error (reaches UI: yes) | `'Could not process this image.'` | — | `The image could not be processed. Choose another image file.` | `app.image.process.error` | none | no |

### Problem tag summary

The counts below count each table record at most once per tag. Records with no issue use `—`.

| Problem tag | Count |
| --- | ---: |
| `abbreviation` | 6 |
| `ambiguous-term` | 46 |
| `caps-emphasis` | 11 |
| `concatenation` | 31 |
| `contraction` | 0 |
| `fragment` | 51 |
| `hard-coded-number-format` | 18 |
| `idiom` | 6 |
| `plural-hack` | 4 |
| `second-person-address-unclear` | 1 |
| `symbol-as-grammar` | 28 |

## Code findings (not fixed here)

- Locale-sensitive number parsing: `src/App.tsx:341,361,365,367-368` and `src/lib/zoom.ts:34` call `Number(...)` on entered text. A decimal comma may not parse as intended. `src/components/CardEditor.tsx:631` also parses a numeric input with `Number(...)`.
- Fixed decimal formatting: `src/App.tsx:248-249,325-327,345` and `src/components/CardEditor.tsx:203,209,293,393` use `toFixed`, which always uses a period rather than a locale-aware decimal separator. Use `Intl.NumberFormat` when these values become localized UI strings.
- Hard-coded units: `src/App.tsx:1056,1194,1216,1273,1290,1303`, `src/components/CardEditor.tsx:293,620,674`, and `src/pdf/CalibrationDoc.tsx:196` include fixed `pt`, `mm`, or `DPI` text.
- Hard-coded paper names: `src/lib/geometry.ts:11-14` defines Letter and A4 dimensions; `src/App.tsx:63,1056,1095` selects and displays those labels directly.
- Left-to-right assumptions: `src/lib/layout.ts:46-55` assigns columns in increasing order; `src/components/CardEditor.tsx:217-224` maps left and right arrow keys directly to horizontal movement. The layout has no direction setting for right-to-left locales.
- PDF number formatting is locale-independent by design: `src/lib/cutSvg.ts:31,40` and `src/lib/cutDxf.ts:113,115` serialize coordinates with fixed decimal points. Keep machine-readable file formats independent of locale unless their format specifications require otherwise.
