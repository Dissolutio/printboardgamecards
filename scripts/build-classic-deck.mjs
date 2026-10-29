#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import opentype from 'opentype.js'
import { optimize } from 'svgo'

// Writes public/decks/classic/{card}.svg and a manifest with:
// { id, name, source, commit, license, viewBox: { width, height }, cards:
//   [{ id, rank, suit, file }] }. Cards are ordered A, 2..10, J, Q, K by
// suit S, H, D, C, followed by Joker1 and Joker2.
const SOURCE_URL = 'https://github.com/notpeter/Vector-Playing-Cards.git'
const SOURCE_COMMIT = '861b338eb931d635c442b568071e3829e552f383'
const SOURCE_PAGE = 'https://github.com/notpeter/Vector-Playing-Cards'
const LICENSE = 'Public domain / WTFPL'
const VIEW_BOX = { width: 167.0869141, height: 242.6669922 }
const JOKER_SAFE_MARGIN = 9.1
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT_DIR = join(ROOT, 'public/decks/classic')
const FONT_DIR = join(ROOT, 'scripts/fonts')
const SVG_NS = 'http://www.w3.org/2000/svg'
const CARD_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const CARD_SUITS = ['S', 'H', 'D', 'C']
const FONT_FILES = {
  arial: 'Arial-LiberationSans.ttf',
  'bitstream vera sans': 'BitstreamVera-DejaVuSans.ttf',
  'urw chancery l': 'URW-Chancery-DejaVuSerif-BoldItalic.ttf',
  lmmathsymbols9: 'LMMathSymbols9-DejaVuMathTeXGyre.ttf',
}
const JOKER_FONT_FILES = {
  'urw chancery l': 'Z003-MediumItalic.otf',
  lmmathsymbols9: 'LatinModernRoman10-BoldItalic.otf',
}
const [FONT_FAMILIES, JOKER_FONT_FAMILIES] = await Promise.all(
  [FONT_FILES, JOKER_FONT_FILES].map(
    async (files) =>
      new Map(
        await Promise.all(
          Object.entries(files).map(async ([family, filename]) => [
            family,
            opentype.parse(await readFile(join(FONT_DIR, filename))),
          ]),
        ),
      ),
  ),
)
const TEXT_STYLE_KEYS = new Set([
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'opacity',
  'color',
  'clip-rule',
])

export function orderedCardIds() {
  return [
    ...CARD_RANKS.flatMap((rank) => CARD_SUITS.map((suit) => `${rank}${suit}`)),
    'Joker1',
    'Joker2',
  ]
}

function parseStyle(style) {
  return Object.fromEntries(
    style
      .split(';')
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .map((declaration) => {
        const separator = declaration.indexOf(':')
        return [declaration.slice(0, separator).trim(), declaration.slice(separator + 1).trim()]
      }),
  )
}

function styleOf(element) {
  return parseStyle(element.getAttribute('style') ?? '')
}

function getAttributeOrStyle(element, name, inheritedStyle) {
  return element.getAttribute(name) || styleOf(element)[name] || inheritedStyle[name] || ''
}

function fontForFamily(family, joker = false) {
  const normalized = family
    .split(',')[0]
    .trim()
    .replace(/^["']|["']$/g, '')
    .toLowerCase()
  const font = (joker ? JOKER_FONT_FAMILIES.get(normalized) : undefined) ??
    FONT_FAMILIES.get(normalized)
  if (!font) throw new Error(`No bundled font maps ${family}`)
  return font
}

function numberAttribute(element, attribute, fallback = 0) {
  const value = Number.parseFloat(element.getAttribute(attribute) ?? '')
  return Number.isFinite(value) ? value : fallback
}

function inheritedVisualStyle(parent, child) {
  const result = { ...styleOf(parent), ...styleOf(child) }
  for (const key of ['fill', 'stroke', 'stroke-width', 'opacity']) {
    if (child.hasAttribute(key)) result[key] = child.getAttribute(key)
    else if (parent.hasAttribute(key)) result[key] = parent.getAttribute(key)
  }
  return Object.fromEntries(
    Object.entries(result).filter(([key]) => TEXT_STYLE_KEYS.has(key)),
  )
}

function writeVisualStyle(pathElement, visualStyle) {
  for (const [name, value] of Object.entries(visualStyle)) {
    pathElement.setAttribute(name, value)
  }
}

function combineBounds(bounds) {
  return {
    minX: Math.min(...bounds.map(({ minX }) => minX)),
    minY: Math.min(...bounds.map(({ minY }) => minY)),
    maxX: Math.max(...bounds.map(({ maxX }) => maxX)),
    maxY: Math.max(...bounds.map(({ maxY }) => maxY)),
  }
}

export function transformBounds(bounds, transform) {
  const corners = [
    [bounds.minX, bounds.minY],
    [bounds.maxX, bounds.minY],
    [bounds.minX, bounds.maxY],
    [bounds.maxX, bounds.maxY],
  ].map(([x, y]) => [
    transform.scale * x + transform.translateX,
    transform.scale * y + transform.translateY,
  ])
  return combineBounds(
    corners.map(([x, y]) => ({ minX: x, minY: y, maxX: x, maxY: y })),
  )
}

export function fitBoundsToSafeArea(bounds, viewBox, margin = 9) {
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  const scale = Math.min(
    1,
    (viewBox.width - 2 * margin) / width,
    (viewBox.height - 2 * margin) / height,
  )
  const translateX = viewBox.width / 2 - scale * (bounds.minX + bounds.maxX) / 2
  const translateY = viewBox.height / 2 - scale * (bounds.minY + bounds.maxY) / 2
  return { scale, translateX, translateY }
}

function jokerWordmarkBounds(root) {
  const bounds = []
  for (const textElement of Array.from(root.getElementsByTagName('text'))) {
    for (const span of Array.from(textElement.getElementsByTagName('tspan'))) {
      const text = Array.from(span.childNodes)
        .filter((node) => node.nodeType === 3 || node.nodeType === 4)
        .map((node) => node.nodeValue ?? '')
        .join('')
        .trim()
      if (!text) continue

      const style = { ...styleOf(textElement), ...styleOf(span) }
      const family = getAttributeOrStyle(span, 'font-family', style) ||
        getAttributeOrStyle(textElement, 'font-family', style) ||
        'Bitstream Vera Sans'
      const fontSize = Number.parseFloat(
        getAttributeOrStyle(span, 'font-size', style) ||
          getAttributeOrStyle(textElement, 'font-size', style) ||
          '16',
      )
      const x = numberAttribute(span, 'x', numberAttribute(textElement, 'x'))
      const y = numberAttribute(span, 'y', numberAttribute(textElement, 'y'))
      const box = fontForFamily(family, true).getPath(text, x, y, fontSize).getBoundingBox()
      const reflected = textElement.getAttribute('transform') === 'scale(-1,-1)'
      bounds.push(
        reflected
          ? { minX: -box.x2, minY: -box.y2, maxX: -box.x1, maxY: -box.y1 }
          : { minX: box.x1, minY: box.y1, maxX: box.x2, maxY: box.y2 },
      )
    }
  }
  if (!bounds.length) throw new Error('No Joker wordmark glyphs found')
  return combineBounds(bounds)
}

function makeGlyphPath(document, textElement, span, text, inheritedStyle, baseX, baseY, joker) {
  const style = {
    ...inheritedStyle,
    ...styleOf(span),
  }
  const family = getAttributeOrStyle(span, 'font-family', style) ||
    getAttributeOrStyle(textElement, 'font-family', style) ||
    'Bitstream Vera Sans'
  const font = fontForFamily(family, joker)
  const fontSize = Number.parseFloat(
    getAttributeOrStyle(span, 'font-size', style) ||
      getAttributeOrStyle(textElement, 'font-size', style) ||
      '16',
  )
  const letterSpacing = Number.parseFloat(
    getAttributeOrStyle(span, 'letter-spacing', style) ||
      getAttributeOrStyle(textElement, 'letter-spacing', style) ||
      '0',
  )
  const anchor = getAttributeOrStyle(span, 'text-anchor', style) ||
    getAttributeOrStyle(textElement, 'text-anchor', style) ||
    'start'
  const advance = font.getAdvanceWidth(text, fontSize) + Math.max(0, text.length - 1) * letterSpacing
  const anchorOffset = anchor === 'middle' ? advance / 2 : anchor === 'end' ? advance : 0
  const x = numberAttribute(span, 'x', baseX) + numberAttribute(span, 'dx') - anchorOffset
  const y = numberAttribute(span, 'y', baseY) + numberAttribute(span, 'dy')
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', font.getPath(text, x, y, fontSize).toPathData(3))
  const transform = span.getAttribute('transform')
  if (transform) path.setAttribute('transform', transform)
  writeVisualStyle(path, inheritedVisualStyle(textElement, span))
  return path
}

function replaceTextElement(document, textElement, wordmarkLayout) {
  const replacement = document.createElementNS(SVG_NS, 'g')
  const transform = textElement.getAttribute('transform')
  if (transform) replacement.setAttribute('transform', transform)

  const parentStyle = styleOf(textElement)
  const baseX = numberAttribute(textElement, 'x')
  const baseY = numberAttribute(textElement, 'y')
  const joker = Boolean(wordmarkLayout)

  function walk(node, inheritedStyle, x, y) {
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 3 || child.nodeType === 4) {
        const text = child.nodeValue?.trim()
        if (text) {
          replacement.appendChild(
            makeGlyphPath(document, textElement, node, text, inheritedStyle, x, y, joker),
          )
        }
      } else if (child.nodeType === 1 && child.localName === 'tspan') {
        const spanStyle = { ...inheritedStyle, ...styleOf(child) }
        const spanX = numberAttribute(child, 'x', x)
        const spanY = numberAttribute(child, 'y', y)
        const spanText = Array.from(child.childNodes)
          .filter((textNode) => textNode.nodeType === 3 || textNode.nodeType === 4)
          .map((textNode) => textNode.nodeValue ?? '')
          .join('')
          .trim()
        if (spanText) {
          replacement.appendChild(
            makeGlyphPath(
              document,
              textElement,
              child,
              spanText,
              spanStyle,
              spanX,
              spanY,
              joker,
            ),
          )
        } else {
          walk(child, spanStyle, spanX, spanY)
        }
      }
    }
  }

  walk(textElement, parentStyle, baseX, baseY)
  if (!wordmarkLayout) return replacement

  const wordmark = document.createElementNS(SVG_NS, 'g')
  wordmark.setAttribute(
    'data-joker-wordmark',
    transform ? 'bottom-right' : 'top-left',
  )
  wordmark.setAttribute(
    'transform',
    `matrix(${wordmarkLayout.scale},0,0,${wordmarkLayout.scale},${wordmarkLayout.translateX},${wordmarkLayout.translateY})`,
  )
  wordmark.appendChild(replacement)
  return wordmark
}

function isCardEdgePath(element) {
  if (element.localName !== 'path') return false
  const d = element.getAttribute('d') ?? ''
  return d.startsWith('M166.8369141,235.5478516c0,3.7773438') &&
    styleOf(element)['stroke-width'] === '0.5'
}

function cleanSourceSvg(source, filename) {
  const parserErrors = []
  const document = new DOMParser({
    onError: (level, message) => parserErrors.push(`${level}: ${message}`),
  }).parseFromString(source, 'image/svg+xml')
  if (parserErrors.length || document.documentElement?.localName !== 'svg') {
    throw new Error(`Invalid SVG ${filename}: ${parserErrors.join('; ')}`)
  }
  const root = document.documentElement
  const isJoker = filename === 'Joker1.svg' || filename === 'Joker2.svg'
  const originalWordmarkBounds = isJoker ? jokerWordmarkBounds(root) : undefined
  const wordmarkLayout = isJoker
    ? fitBoundsToSafeArea(originalWordmarkBounds, VIEW_BOX, JOKER_SAFE_MARGIN)
    : undefined
  if (wordmarkLayout) {
    const bounds = transformBounds(originalWordmarkBounds, wordmarkLayout)
    root.setAttribute(
      'data-joker-wordmark-bounds',
      [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY]
        .map((value) => value.toFixed(5))
        .join(' '),
    )
  }
  root.setAttribute('width', String(VIEW_BOX.width))
  root.setAttribute('height', String(VIEW_BOX.height))
  root.setAttribute('viewBox', `0 0 ${VIEW_BOX.width} ${VIEW_BOX.height}`)

  for (const element of Array.from(root.getElementsByTagName('*'))) {
    if (element.localName === 'metadata' || element.localName === 'namedview') {
      element.parentNode?.removeChild(element)
    } else if (element.localName === 'filter') {
      element.parentNode?.removeChild(element)
    } else if (element.localName === 'text') {
      element.parentNode?.replaceChild(
        replaceTextElement(document, element, wordmarkLayout),
        element,
      )
    } else if (isCardEdgePath(element)) {
      const style = styleOf(element)
      delete style['stroke-width']
      element.setAttribute('style', Object.entries(style).map(([key, value]) => `${key}:${value}`).join(';'))
      element.setAttribute('stroke', 'none')
    }
  }

  for (const element of Array.from(root.getElementsByTagName('*'))) {
    if (element.hasAttribute('filter')) element.removeAttribute('filter')
    const style = styleOf(element)
    if ('filter' in style) {
      delete style.filter
      element.setAttribute('style', Object.entries(style).map(([key, value]) => `${key}:${value}`).join(';'))
    }
  }

  const serialized = new XMLSerializer().serializeToString(root)
  const pathPrecision = isJoker ? 6 : 0
  const transformPrecision = isJoker ? 6 : 2
  const result = optimize(serialized, {
    path: filename,
    multipass: false,
    plugins: [
      {
        name: 'preset-default',
        params: {
          overrides: {
            cleanupNumericValues: { floatPrecision: 10 },
            // Whole-point precision keeps the standard deck small; Joker suits need source precision.
            convertPathData: {
              floatPrecision: pathPrecision,
              transformPrecision,
            },
          },
        },
      },
      'reusePaths',
    ],
  })
  return result.data
}

async function build() {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'classic-playing-cards-'))
  try {
    execFileSync('git', ['init', '--quiet', temporaryDirectory])
    execFileSync(
      'git',
      ['-C', temporaryDirectory, 'fetch', '--depth=1', SOURCE_URL, SOURCE_COMMIT],
      { stdio: 'inherit' },
    )
    execFileSync('git', ['-C', temporaryDirectory, 'checkout', '--quiet', '--detach', 'FETCH_HEAD'])
    const sourceDirectory = join(temporaryDirectory, 'cards-svg')
    const sourceNames = await readdir(sourceDirectory)
    const sourceSet = new Set(sourceNames.filter((name) => name.endsWith('.svg')).map((name) => name.slice(0, -4)))
    const ids = orderedCardIds()
    if (sourceSet.size !== ids.length || ids.some((id) => !sourceSet.has(id))) {
      throw new Error('The pinned source does not contain exactly the expected 54 card SVGs')
    }

    await mkdir(OUTPUT_DIR, { recursive: true })
    for (const name of await readdir(OUTPUT_DIR)) {
      if (name.endsWith('.svg') || name === 'manifest.json') {
        await rm(join(OUTPUT_DIR, name), { force: true })
      }
    }

    const cards = []
    for (const id of ids) {
      const rank = id.startsWith('Joker') ? 'Joker' : id.slice(0, -1)
      const suit = id.startsWith('Joker') ? null : id.slice(-1)
      const filename = `${id}.svg`
      const source = await readFile(join(sourceDirectory, filename), 'utf8')
      const svg = cleanSourceSvg(source, filename)
      await writeFile(join(OUTPUT_DIR, filename), `${svg}\n`, 'utf8')
      cards.push({ id, rank, suit, file: filename })
    }

    const manifest = {
      id: 'classic',
      name: 'Classic',
      source: SOURCE_PAGE,
      commit: SOURCE_COMMIT,
      license: LICENSE,
      viewBox: VIEW_BOX,
      cards,
    }
    await writeFile(join(OUTPUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    const bytes = (await Promise.all(cards.map(({ file }) => readFile(join(OUTPUT_DIR, file)))))
      .reduce((total, svg) => total + svg.byteLength, 0)
    console.log(`Built ${cards.length} cards (${(bytes / 1024 / 1024).toFixed(2)} MiB of SVG).`)
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await build()
}
