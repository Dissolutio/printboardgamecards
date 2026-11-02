import type { Catalog } from './messages.ts'

export const en: Catalog = {
  'calibration.offset.current': 'Current offset: X {x} mm, Y {y} mm.',
  'calibration.reset.button': 'Reset offsets',
  'calibration.download.preparing': 'Preparing the calibration sheet.',
  'calibration.download.button': 'Download calibration sheet',
  'calibration.instructions.actualSize': 'Print the sheet at 100% scale.',
  'calibration.instructions.longEdge': 'Turn it over along its long edge. Print page 2 on the back.',
  'calibration.instructions.light': 'Hold the sheet toward a light. Look from the front side.',
  'calibration.instructions.cornerMarks':
    'Look at one corner mark. The circle is the front mark. The square is the back mark.',
  'calibration.instructions.horizontalReading':
    'Find where the vertical line of the back mark crosses the horizontal scale of the front mark. Read the number in millimeters.',
  'calibration.instructions.verticalReading':
    'Find where the horizontal line of the back mark crosses the vertical scale. Read that number.',
  'calibration.instructions.direction':
    'Positive numbers are to the right and downward. Negative numbers are to the left and upward.',
  'calibration.instructions.average':
    'Read two opposite corners. If the readings differ by more than {limit} {unit}, enter the average offset.',
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
    'Find the two dashed fold lines at the ends of the long scale on the front page.',
  'calibration.scale.fold.step2':
    'Fold the left edge of the paper over so the crease runs along the left fold line. The printed side stays inside. Press the crease flat.',
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
  'calibration.measured.legend': 'Measured correction',
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
