// An 11x10 pixel-art heart: a one-pixel outline around an interior that
// fills from the bottom up, so the heart drains from the top as the cache
// cools, down to the bare outline.

const MASK = [
  '..XXX.XXX..',
  '.XXXXXXXXX.',
  'XXXXXXXXXXX',
  'XXXXXXXXXXX',
  'XXXXXXXXXXX',
  '.XXXXXXXXX.',
  '..XXXXXXX..',
  '...XXXXX...',
  '....XXX....',
  '.....X.....',
]

export const WIDTH = 11
export const HEIGHT = 10

const isIn = (x: number, y: number) => MASK[y]?.[x] === 'X'

type Pixel = { x: number; y: number }

const pixels: Pixel[] = MASK.flatMap((row, y) =>
  [...row].flatMap((c, x) => (c === 'X' ? [{ x, y }] : [])),
)
const isEdge = ({ x, y }: Pixel) =>
  !isIn(x - 1, y) || !isIn(x + 1, y) || !isIn(x, y - 1) || !isIn(x, y + 1)

const outline = pixels.filter(isEdge)
// Filled in this order: the bottom row first, each row left to right.
const interior = pixels
  .filter(p => !isEdge(p))
  .sort((a, b) => b.y - a.y || a.x - b.x)

const SHINE = [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 3 }]

export type Palette = { outline: string; fill: string; shine: string }

export const WARM: Palette = { outline: '#b3123a', fill: '#ff3d5e', shine: '#ffc2cc' }
export const COLD: Palette = { outline: '#8a8a8a', fill: '#8a8a8a', shine: '#8a8a8a' }

// The pixels to paint for a heart `level` full (0 to 1), with their colors.
export function heartPixels(level: number, palette: Palette): Array<Pixel & { color: string }> {
  const filled = Math.round(Math.min(1, Math.max(0, level)) * interior.length)
  const isShine = (p: Pixel) => SHINE.some(s => s.x === p.x && s.y === p.y)

  return [
    ...outline.map(p => ({ ...p, color: palette.outline })),
    ...interior.slice(0, filled).map(p => ({
      ...p,
      color: isShine(p) ? palette.shine : palette.fill,
    })),
  ]
}

export function heartSvg(level: number, palette: Palette): string {
  const rects = heartPixels(level, palette)
    .map(p => `<rect x="${p.x}" y="${p.y}" width="1" height="1" fill="${p.color}"/>`)
    .join('')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" ` +
    `width="${WIDTH * 2}" height="${HEIGHT * 2}" shape-rendering="crispEdges">${rects}</svg>`
  )
}

// RGBA bytes, each heart pixel SCALE x SCALE so the terminal's scaling
// keeps the edges hard.
const SCALE = 4

export function heartRgba(level: number, palette: Palette) {
  const width = WIDTH * SCALE
  const height = HEIGHT * SCALE
  const bytes = new Uint8Array(width * height * 4)

  for (const p of heartPixels(level, palette)) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(p.color.slice(i, i + 2), 16))
    for (let dy = 0; dy < SCALE; dy++) {
      for (let dx = 0; dx < SCALE; dx++) {
        const at = ((p.y * SCALE + dy) * width + p.x * SCALE + dx) * 4
        bytes.set([r ?? 0, g ?? 0, b ?? 0, 255], at)
      }
    }
  }

  return { rgba: toBase64(bytes), width, height }
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function toBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const [a = 0, b = 0, c = 0] = [bytes[i], bytes[i + 1], bytes[i + 2]]
    const n = (a << 16) | (b << 8) | c
    out += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]!
    out += i + 1 < bytes.length ? ALPHABET[(n >> 6) & 63]! : '='
    out += i + 2 < bytes.length ? ALPHABET[n & 63]! : '='
  }
  return out
}
