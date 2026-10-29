# UI copy guide

## Voice

Use friendly, calm language that tells people what the app does or what to do next. Be literal and direct.

| Good | Avoid |
| --- | --- |
| Measure the offset at two corners. | Take a look at the corners. |
| Enter the average offset. | Enter the average and tell us. |
| Print the second page on the back of the sheet. | Flip the sheet and print page two. |

## Rules

- Put one idea in each sentence. Aim for 15 words or fewer.
- Use active voice. Use the imperative for instructions: “Measure the offset.”
- Do not use idioms, slang, humor, puns, metaphors, or figurative phrasal verbs.
- Do not use contractions. Write “do not,” not “don’t.”
- Do not use “e.g.” or “i.e.” Write “for example” or explain the example directly.
- Do not abbreviate words, except for unit symbols (`mm`, `pt`) and the terms DPI, PDF, SVG, and DXF.
- Do not use capitals, symbols, arrows, colors, or punctuation to carry meaning. Write “A negative offset moves the back to the left,” not “negative = left.” Do not use a middle dot as a separator or “(s)” to mark a plural.
- Write every message as one complete string. Never build a sentence from fragments or concatenate sentence pieces.
- Use named placeholders such as `{count}` and `{unit}`. Keep a number and its unit in separate parameters.
- Give each count its own complete message for the plural categories used by `Intl.PluralRules`. Never make a plural by adding “s” in code.
- Format numbers with `Intl.NumberFormat`. Do not assume a decimal separator.
- Use stable patterns: buttons are verb phrases (“Download PDF”), labels are nouns (“Paper size”), and hints are complete sentences ending with a period.
- Errors state what happened and what the person can do next.
- Use the same preferred word for the same concept everywhere. Follow the glossary below.
- Keep PDF text minimal. PDF fonts cover Latin letters only, so prefer numbers, unit symbols, and necessary marks.
- Apply these rules to accessible names and text in `aria-label`, `title`, `alt`, and `placeholder` attributes.

## Glossary

Use the preferred term in the first column. Do not alternate “piece” and “card”; use “card.” Avoid other near-synonyms listed below.

| Preferred term | Plain definition for help text | Do not alternate with |
| --- | --- | --- |
| Card | A card is one item in your deck. | piece |
| Front | The front is the first side of a card. | face one |
| Back | The back is the second side of a card. | reverse |
| Deck | A deck is the set of cards in your project. | pack |
| Copy / copies | A copy is one printed instance of a card. | duplicate (for a printed count) |
| Trim (cut size) | Trim is the final card size after cutting. | finished size |
| Bleed | Bleed is artwork or color printed beyond the trim edge. | extra edge |
| Safe area | The safe area is the part of a card where important content should stay. | live area |
| Crop marks | Crop marks show where to cut a card. | trim marks |
| Registration marks | Registration marks help compare the positions of the front and back. | alignment marks |
| Cut file | A cut file gives a cutting machine the card outlines. | cutter file |
| Bleed color | Bleed color is the solid color printed beyond the trim edge. | edge color |
| Background | A background is a solid color behind the card image. | canvas |
| Fit | Fit shows the whole image inside the card area. | contain |
| Fill | Fill covers the whole card area and may crop the image. | cover |
| Zoom | Zoom changes how large the image appears in the crop area. | magnification |
| Crop | A crop is the part of an image kept on a card. | clipping |
| Page | A page is one printed side of a sheet. | leaf |
| Sheet | A sheet is one piece of paper used for printing. | page (when referring to paper) |
| Paper size | Paper size is the width and height of a sheet. | paper format |
| Print and glue | Print and glue puts card fronts and backs on separate pages to cut and join. | single-sided assembly |
| Double-sided | Double-sided printing puts card fronts and backs on opposite sides of a sheet. | duplex |
| Hand cut | Hand cut means you cut the cards with a tool by hand. | manual cut |
| Machine cut | Machine cut means a cutting machine follows a cut file. | automatic cut |
| Calibration | Calibration measures and corrects how a printer aligns the back with the front. | alignment setup |
| Offset | An offset is the measured distance between the front and back marks. | shift |
| Printer profile | A printer profile stores calibration offsets for one printer. | printer preset |
| Original PDF | The original PDF has no printer-specific calibration. | shareable PDF |
| Calibrated PDF | A calibrated PDF applies the selected printer profile's offsets. | adjusted PDF |
| Project file | A project file stores the deck and its settings so you can continue later. | save file |
| DPI | DPI is the number of image dots used for each printed inch. | resolution (when showing a DPI value) |
| Card orientation | Card orientation describes how a card appears on the printed page. | piece orientation |
| Portrait | Portrait means the card is taller than it is wide on the printed page. | upright |
| Landscape | Landscape means the card is wider than it is tall on the printed page. | rotated |

### Card orientation decision

Label the setting **Card orientation**. Use **Auto**, **Portrait**, and **Landscape** as its options. Describe the card as it appears on the printed page: Portrait is taller than it is wide; Landscape is wider than it is tall. Auto shows its result, for example, “Auto (Landscape, 8 cards per page).” Add this hint: “This setting changes card orientation, not paper orientation.” The stored values `UPRIGHT` and `ROTATED` remain unchanged.
