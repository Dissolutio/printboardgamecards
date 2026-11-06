import type { Catalog } from './messages.ts'

export const en: Catalog = {
  'start.adjustPdf.title': 'Have your own PDF?',
  'start.adjustPdf.description':
    'Calibrate your printer, then upload your two-sided PDF. We shift the back pages to match your printer.',
  'start.adjustPdf.button': 'Adjust my PDF',
  'adjustPdf.dialog.title': 'Adjust my PDF',
  'adjustPdf.close': 'Close',
  'adjustPdf.paper.label': 'Calibration paper size',
  'adjustPdf.cardSize.label': 'Calibration card size',
  'adjustPdf.cardSize.poker': 'Poker',
  'adjustPdf.cardSize.bridge': 'Bridge',
  'adjustPdf.cardSize.mini': 'Mini',
  'adjustPdf.cardSize.tarot': 'Tarot',
  'adjustPdf.file.label': 'Two-sided PDF',
  'adjustPdf.file.prompt': 'Drop a PDF here or choose a file.',
  'adjustPdf.file.choose': 'Choose PDF',
  'adjustPdf.file.empty': 'Choose a PDF file to adjust.',
  'adjustPdf.firstPageIsFront': 'Page 1 is a front',
  'adjustPdf.note.pages.front':
    'Back pages are pages 2, 4, 6, and the later even pages.',
  'adjustPdf.note.pages.back':
    'Back pages are pages 1, 3, 5, and the later odd pages.',
  'adjustPdf.note.offset':
    'We move every back page by {x} mm horizontally and {y} mm vertically. Front pages do not change. Your file stays on your device.',
  'adjustPdf.noCorrection':
    'Your printer profile has no correction yet. Run the calibration first, or download an unchanged copy.',
  'adjustPdf.adjust.button': 'Adjust PDF',
  'adjustPdf.adjust.working': 'Adjusting PDF.',
  'adjustPdf.adjust.testSheet':
    'This moves the back pages. It cannot fix a printer that turns the paper at an angle. Print one test sheet before a big job.',
  'adjustPdf.success.summary': {
    one: 'Moved {count} back page.',
    other: 'Moved {count} back pages.',
  },
  'adjustPdf.calibration.error':
    'The calibration sheet could not be created. Try again.',
  'adjustPdf.error.notAPdf': 'This file is not a valid PDF. Choose a PDF file and try again.',
  'adjustPdf.error.encrypted':
    'This PDF needs a password. Save a copy without a password and try again.',
  'adjustPdf.error.empty': 'This PDF has no pages. Choose a PDF with at least one page.',
  'adjustPdf.error.rotated':
    'This PDF has rotated pages. Rotate the pages in another app and try again.',
  'adjustPdf.error.annotations':
    'This PDF has annotations that cannot be preserved. Remove them in another app and try again.',
  'adjustPdf.error.tooLarge': 'This PDF exceeds the size limit. Choose a smaller PDF.',
  'calibration.offset.current': 'Current offset: X {x} mm, Y {y} mm.',
  'calibration.reset.button': 'Reset offsets',
  'calibration.intro':
    'Your printer may already be accurate. This check tells you whether you need to correct anything. If you cut by hand, you will probably not need to.',
  'calibration.step.download': 'Download the sheet',
  'calibration.step.setup': 'Set up the print',
  'calibration.step.scale': 'Check the printer scale',
  'calibration.step.corners': 'Read the corners',
  'calibration.step.result': 'Result',
  'calibration.download.preparing': 'Preparing the calibration sheet.',
  'calibration.download.button': 'Download calibration sheet',
  'calibration.setup.scale':
    'Choose Actual Size, 100 percent, or None. Turn off Fit to Page, Shrink to Printable Area, and Auto Rotate and Center.',
  'calibration.setup.scale.why':
    'These settings shrink or move the page. That makes every reading inaccurate.',
  'calibration.setup.duplex':
    'If your printer prints both sides by itself, choose Two-sided with Long Edge. This is also called Flip on long edge. Print both pages in one job.',
  'calibration.setup.duplex.why':
    'The printer flips the paper for you. This is more accurate than turning the sheet by hand.',
  'calibration.setup.hand':
    'If you must turn the sheet by hand, turn it as you turn a book page. Keep the top at the top. Hold the sheet to a light. Check that the arrows labeled front and back both point up.',
  'calibration.setup.hand.why':
    'A downward arrow means you flipped the sheet the wrong way.',
  'calibration.instructions.cornerMarks':
    'The front mark is a crosshair with a millimeter scale. The back mark is a crosshair with a small square.',
  'calibration.instructions.direction':
    'A positive horizontal reading places the back mark to the right. A positive vertical reading places it lower. A negative horizontal reading places it to the left. A negative vertical reading places it higher.',
  'calibration.instructions.average':
    'Read two opposite corners. If the readings differ by more than {limit} {unit}, enter the average offset.',
  'calibration.instructions.zero':
    'The longest tick marks zero. Each longer tick after zero marks one millimeter. The numbers 5 and -5 mark the ends.',
  'calibration.instructions.horizontal':
    'Find where the vertical line of the back mark crosses the horizontal scale. Count the longer ticks from zero.',
  'calibration.instructions.fraction':
    'If the line falls between two longer ticks, estimate the part of a millimeter.',
  'calibration.instructions.vertical':
    'Find where the horizontal line of the back mark crosses the vertical scale. Count the same way.',
  'calibration.scale.stop':
    'Stop here. Fix the print settings and print the sheet again before you read the corners.',
  'calibration.advice.skip':
    'Your printer is accurate enough. You do not need to apply a correction.',
  'calibration.advice.apply':
    'Apply this correction, then print the sheet again to check it.',
  'calibration.scale.heading': 'Check the printer scaling',
  'calibration.scale.location': 'Look at the long scale at the top or bottom of the front page.',
  'calibration.scale.count':
    'Count the empty spaces between the last tick and the paper edge on the left. Do the same on the right.',
  'calibration.scale.total.instruction': 'Enter the total of both counts.',
  'calibration.scale.total.label': 'Total of both counts',
  'calibration.scale.total.expected': 'The expected total is {value}.',
  'calibration.number.error': 'Enter a number.',
  'calibration.scale.verdict.ok': 'The printer scale is close to 100 percent.',
  'calibration.scale.verdict.small':
    'The printer made the page smaller. Print again at Actual Size and do not use Fit to Page.',
  'calibration.scale.verdict.large':
    'The printer made the page larger. Print again at Actual Size and do not use Fit to Page.',
  'calibration.scale.estimate': 'Estimated printer scale is {scale}.',
  'calibration.scale.intro':
    'Check that your printer printed at 100 percent. Use either method.',
  'calibration.scale.fold.heading': 'Method A: Fold the paper',
  'calibration.scale.fold.step1':
    'Find the two long vertical lines at the left and right ends of the long scale on the front page.',
  'calibration.scale.fold.step2':
    'Fold the edge of the page over to the line on the left side. The printed side stays inside. Crease along the line and press it flat.',
  'calibration.scale.fold.step3':
    'The paper edge now lies over a small gauge. Read the number at the edge. If it falls between two ticks, choose the nearer tick. Unfold the paper.',
  'calibration.scale.fold.step4': 'Do the same on the right edge.',
  'calibration.scale.fold.input.label':
    'Left reading plus right reading (tick spaces)',
  'calibration.scale.fold.input.expected':
    'The expected total is {value} {unit} on {paper} paper.',
  'calibration.scale.fold.unit': 'tick spaces',
  'calibration.scale.ruler.heading': 'Method B: Use a ruler',
  'calibration.scale.ruler.instruction':
    'Place a ruler on the two long end lines of the scale. They should be {distance} {unit} ({inches} {inchUnit}) apart.',
  'calibration.scale.ruler.unit.mm': 'mm',
  'calibration.scale.ruler.unit.inch': 'in',
  'calibration.scale.ruler.input.label': 'Measured distance (mm)',
  'calibration.scale.disagree':
    'The two readings disagree. Check your folds and measurements.',
  'calibration.scale.unavailable':
    'This card size has no long scale on the calibration sheet.',
  'calibration.offsetX.label': 'Horizontal reading on the printed scale (mm)',
  'calibration.offsetX.hint':
    'Enter a positive number if the back mark is to the right of the front mark. Enter a negative number if it is to the left.',
  'calibration.offsetY.label': 'Vertical reading on the printed scale (mm)',
  'calibration.offsetY.hint':
    'Enter a positive number if the back mark is lower than the front mark. Enter a negative number if it is higher.',
  'calibration.apply.button': 'Apply correction',
  'calibration.offset.updated':
    'The offset was updated. Print a new calibration sheet to check the result.',
  'calibration.offsetX.current.label': 'Current horizontal offset (mm)',
  'calibration.offsetY.current.label': 'Current vertical offset (mm)',
  'calibration.offset.edit.summary': 'Edit offsets directly',
  'cardFace.empty.front': 'No front image',
  'cardFace.empty.back': 'No back image',
  'undo.button': 'Undo',
  'redo.button': 'Redo',
  'undo.toast.cardDeleted': 'Card deleted.',
  'undo.toast.imageRemoved': 'Image removed.',
  'undo.toast.backsReplaced': {
    one: 'Back replaced on {count} card.',
    other: 'Backs replaced on {count} cards.',
  },
  'undo.toast.projectOpened': 'Project opened.',
  'undo.toast.starterDeckCreated': 'New deck created.',
  'cardFace.background.front': 'Front side: background color, no image.',
  'cardFace.background.back': 'Back side: background color, no image.',
  'card.copyCount.output': {
    one: '{count} copy',
    other: '{count} copies',
  },
  'cardEditor.emptyDeck': 'Add a card to start building your deck.',
  'cardEditor.header.title': 'Card {number}',
  'cardEditor.header.position': 'Card {current} of {total}',
  'cardEditor.navigation.previous': 'Previous card',
  'cardEditor.navigation.next': 'Next card',
  'cardEditor.copies': 'Copies',
  'cardEditor.copies.fewer': 'Fewer copies',
  'cardEditor.copies.more': 'More copies',
  'cardEditor.close': 'Close',
  'cardEditor.tabs.label': 'Card side',
  'cardEditor.tabs.front': 'Front',
  'cardEditor.tabs.back': 'Back',
  'cardEditor.replace': 'Replace',
  'cardEditor.replace.front': 'Replace front image',
  'cardEditor.replace.back': 'Replace back image',
  'cardEditor.removeImage': 'Remove image',
  'cardEditor.fit': 'Fit',
  'cardEditor.fill': 'Fill',
  'cardEditor.zoom': 'Zoom',
  'cardEditor.zoom.slider': 'Zoom. Left and Right arrow keys change zoom by 0.01.',
  'cardEditor.zoom.outCoarse': 'Zoom out by 0.1',
  'cardEditor.zoom.inCoarse': 'Zoom in by 0.1',
  'cardEditor.zoom.outFine': 'Zoom out by 0.01',
  'cardEditor.zoom.inFine': 'Zoom in by 0.01',
  'cardEditor.zoom.steps':
    'The minus and plus buttons change zoom by 0.1. The arrow buttons change zoom by 0.01.',
  'cardEditor.zoom.exact': 'Type an exact zoom value. Up and Down arrow keys change zoom by 0.01.',
  'cardEditor.background': 'Use a background color',
  'cardEditor.backgroundColor': 'Background color',
  'cardEditor.dpi.good': 'Good for printing.',
  'cardEditor.dpi.low': 'This crop is below 200 DPI and may print blurry.',
  'cardEditor.liveResult': 'Live result',
  'cardEditor.bleed.title': 'Bleed',
  'cardEditor.bleed.mode': 'Bleed mode for this card',
  'cardEditor.bleed.extendImage': 'Extend image',
  'cardEditor.bleed.solidColor': 'Solid color',
  'cardEditor.bleed.color': 'Bleed color',
  'cardEditor.bleed.cropArea': 'Crop area is {width} by {height} pt.',
  'cardEditor.bleed.summary': 'Bleed is {bleed} pt.',
  'cardEditor.bleed.cardSize': 'Card size is {width} by {height} pt.',
  'cardEditor.back.count': {
    one: 'This back is used on {count} card.',
    other: 'This back is used on {count} cards.',
  },
  'cardEditor.back.useForEveryCard': 'Use this back for every card',
  'cardEditor.back.hint': 'Other cards keep their own fronts.',
  'cardEditor.footer.duplicate': 'Duplicate card',
  'cardEditor.footer.delete': 'Delete card',
  'cardEditor.footer.saveNote': 'Changes save as you work.',
  'cardEditor.footer.done': 'Done',
  'cardEditor.delete.title': 'Delete this card?',
  'cardEditor.delete.message':
    'The card and its images will be removed from the deck. You can undo this.',
  'cardEditor.delete.confirm': 'Delete card',
  'printSummary.paper.LETTER': 'Letter',
  'printSummary.paper.A4': 'A4',
  'printSummary.mode.ONE_SIDE_GLUE': 'Print and glue.',
  'printSummary.mode.TWO_SIDES_HAND': 'Double-sided printing for hand cutting.',
  'printSummary.mode.TWO_SIDES_MACHINE': 'Double-sided printing for machine cutting.',
  'printSummary.layout.landscape':
    '{paper} paper. {mode} Cards turned to landscape, {columns} columns by {rows} rows.',
  'printSummary.layout.portrait':
    '{paper} paper. {mode} Cards turned to portrait, {columns} columns by {rows} rows.',
}
