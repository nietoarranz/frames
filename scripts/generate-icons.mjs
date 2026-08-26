import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { crc32, deflateSync } from "node:zlib"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const outDir = join(root, "public")

const OUTER_MIN = 17
const OUTER_MAX = 82
const INNER_MIN = 22
const INNER_MAX = 77
const VIEWBOX = 100
const SUPER_SAMPLE = 8

function crc(buffer) {
  const value = crc32(buffer)
  const bytes = Buffer.alloc(4)
  bytes.writeUInt32BE(value >>> 0)
  return bytes
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  return Buffer.concat([length, typeBuffer, data, crc(Buffer.concat([typeBuffer, data]))])
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1)
    raw[rowStart] = 0
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ])
}

function sampleCoverage(px, py, size) {
  let white = 0
  const samples = SUPER_SAMPLE
  const step = 1 / samples

  for (let sy = 0; sy < samples; sy++) {
    for (let sx = 0; sx < samples; sx++) {
      const x = ((px + (sx + 0.5) * step) * VIEWBOX) / size
      const y = ((py + (sy + 0.5) * step) * VIEWBOX) / size
      const inOuter =
        x >= OUTER_MIN && x < OUTER_MAX && y >= OUTER_MIN && y < OUTER_MAX
      const inInner =
        x >= INNER_MIN && x < INNER_MAX && y >= INNER_MIN && y < INNER_MAX
      if (inOuter && !inInner) white++
    }
  }

  return white / (samples * samples)
}

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const coverage = sampleCoverage(x, y, size)
      const value = Math.round(255 * coverage)
      const i = (y * size + x) * 4
      rgba[i] = value
      rgba[i + 1] = value
      rgba[i + 2] = value
      rgba[i + 3] = 255
    }
  }

  return encodePng(size, size, rgba)
}

function encodeIco(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)

  const entries = []
  const payloads = []
  let offset = 6 + 16 * images.length

  for (const { size, png } of images) {
    const entry = Buffer.alloc(16)
    entry[0] = size === 256 ? 0 : size
    entry[1] = size === 256 ? 0 : size
    entry[2] = 0
    entry[3] = 0
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(png.length, 8)
    entry.writeUInt32LE(offset, 12)
    entries.push(entry)
    payloads.push(png)
    offset += png.length
  }

  return Buffer.concat([header, ...entries, ...payloads])
}

const pngSizes = {
  "favicon-16x16.png": 16,
  "favicon-32x32.png": 32,
  "apple-touch-icon.png": 180,
  "icon-192.png": 192,
  "icon-512.png": 512,
}

await mkdir(outDir, { recursive: true })

const pngFiles = {}
for (const [name, size] of Object.entries(pngSizes)) {
  process.stdout.write(`Generating ${name} (${size}x${size})...\n`)
  pngFiles[name] = renderIcon(size)
  await writeFile(join(outDir, name), pngFiles[name])
}

const ico = encodeIco([
  { size: 16, png: pngFiles["favicon-16x16.png"] },
  { size: 32, png: pngFiles["favicon-32x32.png"] },
  { size: 48, png: renderIcon(48) },
])
await writeFile(join(outDir, "favicon.ico"), ico)

console.log("Wrote favicon.ico and PNG icons.")
