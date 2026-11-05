export const PRESET_COLORS = [
  "#FFFFFF",
  "#F4EFE6",
  "#E5E5E5",
  "#A3A3A3",
  "#262626",
  "#000000",
]

const RECENT_COLORS_KEY = "frames:recent-colors"
const RECENT_COLORS_LIMIT = 8
const SAMPLE_SIZE = 64

export function toHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((value) =>
      Math.round(Math.min(Math.max(value, 0), 255))
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`.toUpperCase()
}

function fromHex(hex: string) {
  const value = Number.parseInt(hex.slice(1, 7), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const
}

function colorDistance(a: string, b: string) {
  const [ar, ag, ab] = fromHex(a)
  const [br, bg, bb] = fromHex(b)
  return Math.hypot(ar - br, ag - bg, ab - bb)
}

/**
 * Most common colors in RGBA pixel data. Pixels are grouped into 4-bit
 * buckets per channel, and each result is the average of its bucket.
 * Colors closer than `minDistance` to one already picked are skipped.
 */
export function paletteFromPixels(
  data: ArrayLike<number>,
  count = 5,
  minDistance = 48
): string[] {
  const buckets = new Map<
    number,
    { r: number; g: number; b: number; n: number }
  >()

  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) {
      continue
    }

    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.r += r
      bucket.g += g
      bucket.b += b
      bucket.n += 1
    } else {
      buckets.set(key, { r, g, b, n: 1 })
    }
  }

  const palette: string[] = []
  const sorted = [...buckets.values()].sort((a, b) => b.n - a.n)

  for (const bucket of sorted) {
    const hex = toHex(
      bucket.r / bucket.n,
      bucket.g / bucket.n,
      bucket.b / bucket.n
    )
    if (palette.every((picked) => colorDistance(picked, hex) >= minDistance)) {
      palette.push(hex)
      if (palette.length === count) {
        break
      }
    }
  }

  return palette
}

const paletteCache = new WeakMap<HTMLImageElement, string[]>()

export function extractPalette(image: HTMLImageElement, count = 5) {
  const cached = paletteCache.get(image)
  if (cached) {
    return cached
  }

  let palette: string[] = []

  try {
    const canvas = document.createElement("canvas")
    canvas.width = SAMPLE_SIZE
    canvas.height = SAMPLE_SIZE
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (ctx) {
      ctx.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
      palette = paletteFromPixels(
        ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data,
        count
      )
    }
  } catch {
    // Unreadable image: no suggestions.
  }

  paletteCache.set(image, palette)
  return palette
}

/** Merges palettes in order, dropping near-duplicates. */
export function mergePalettes(
  palettes: string[][],
  limit = 6,
  minDistance = 48
) {
  const merged: string[] = []

  for (const color of palettes.flat()) {
    if (merged.every((picked) => colorDistance(picked, color) >= minDistance)) {
      merged.push(color)
      if (merged.length === limit) {
        break
      }
    }
  }

  return merged
}

export function addRecentColor(
  colors: string[],
  hex: string,
  limit = RECENT_COLORS_LIMIT
) {
  const color = hex.toUpperCase()
  return [
    color,
    ...colors.filter((item) => item.toUpperCase() !== color),
  ].slice(0, limit)
}

export function loadRecentColors(): string[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(RECENT_COLORS_KEY) ?? "[]"
    )
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (item): item is string =>
              typeof item === "string" && /^#[\da-f]{6}$/i.test(item)
          )
          .slice(0, RECENT_COLORS_LIMIT)
      : []
  } catch {
    return []
  }
}

export function saveRecentColors(colors: string[]) {
  try {
    localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(colors))
  } catch {
    // Storage unavailable (private mode, quota): keep colors in memory only.
  }
}
