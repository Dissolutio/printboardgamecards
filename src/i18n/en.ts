import type { Catalog } from './messages.ts'

export const en: Catalog = {
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
