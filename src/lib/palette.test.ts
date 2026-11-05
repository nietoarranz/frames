import { describe, expect, it } from "vitest"

import {
  addRecentColor,
  mergePalettes,
  paletteFromPixels,
  toHex,
} from "@/lib/palette"

function pixels(...colors: Array<[number, number, number, number?]>) {
  return colors.flatMap(([r, g, b, a = 255]) => [r, g, b, a])
}

describe("toHex", () => {
  it("formats and clamps channels", () => {
    expect(toHex(255, 128.4, -3)).toBe("#FF8000")
  })
})

describe("paletteFromPixels", () => {
  it("orders colors by how often they appear", () => {
    const data = pixels(
      [0, 0, 255],
      [255, 0, 0],
      [255, 0, 0],
      [255, 0, 0],
      [0, 0, 255]
    )

    expect(paletteFromPixels(data)).toEqual(["#FF0000", "#0000FF"])
  })

  it("skips transparent pixels", () => {
    expect(paletteFromPixels(pixels([255, 255, 255, 0], [0, 0, 0]))).toEqual([
      "#000000",
    ])
  })

  it("drops colors too close to one already picked", () => {
    const data = pixels([200, 0, 0], [200, 0, 0], [220, 10, 0], [0, 200, 0])

    expect(paletteFromPixels(data)).toEqual(["#C80000", "#00C800"])
  })

  it("returns at most `count` colors", () => {
    const data = pixels([0, 0, 0], [255, 255, 255], [255, 0, 0], [0, 0, 255])

    expect(paletteFromPixels(data, 2)).toHaveLength(2)
  })
})

describe("mergePalettes", () => {
  it("dedupes near-identical colors across photos", () => {
    expect(
      mergePalettes([
        ["#FF0000", "#000000"],
        ["#FE0101", "#FFFFFF"],
      ])
    ).toEqual(["#FF0000", "#000000", "#FFFFFF"])
  })
})

describe("addRecentColor", () => {
  it("moves a reused color to the front without duplicating it", () => {
    expect(addRecentColor(["#111111", "#ABCDEF"], "#abcdef")).toEqual([
      "#ABCDEF",
      "#111111",
    ])
  })

  it("keeps only the newest colors", () => {
    expect(addRecentColor(["#000001", "#000002"], "#000003", 2)).toEqual([
      "#000003",
      "#000001",
    ])
  })
})
