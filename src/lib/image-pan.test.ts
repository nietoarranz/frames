import { describe, expect, it } from "vitest"

import {
  clampPan,
  coverFit,
  getCoverSourceRect,
  getFitOverflow,
  panFromPointerDelta,
  toggleImageFit,
} from "@/lib/image-pan"

describe("coverFit", () => {
  it("fills the height when the photo is wider than the slot", () => {
    expect(coverFit(4000, 1000, 1, 2)).toBe("height")
  })

  it("fills the width when the photo is taller than the slot", () => {
    expect(coverFit(1000, 4000, 2, 1)).toBe("width")
  })

  it("falls back to width for empty sizes", () => {
    expect(coverFit(0, 100, 1, 1)).toBe("width")
  })
})

describe("toggleImageFit", () => {
  it("switches between width and height", () => {
    expect(toggleImageFit("width")).toBe("height")
    expect(toggleImageFit("height")).toBe("width")
  })
})

describe("clampPan", () => {
  it("keeps both axes between 0 and 1", () => {
    expect(clampPan({ x: -0.5, y: 1.5 })).toEqual({ x: 0, y: 1 })
  })
})

describe("getFitOverflow", () => {
  it("only overflows vertically when filling the width", () => {
    expect(getFitOverflow(1000, 2000, 100, 100, "width")).toEqual({
      overflowX: 0,
      overflowY: 100,
    })
  })

  it("only overflows horizontally when filling the height", () => {
    expect(getFitOverflow(2000, 1000, 100, 100, "height")).toEqual({
      overflowX: 100,
      overflowY: 0,
    })
  })
})

describe("panFromPointerDelta", () => {
  it("moves the pan against the drag, scaled by the overflow", () => {
    expect(panFromPointerDelta({ x: 0.5, y: 0.5 }, 25, 0, 100, 0)).toEqual({
      x: 0.25,
      y: 0.5,
    })
  })

  it("clamps at the edges", () => {
    expect(panFromPointerDelta({ x: 0.5, y: 0.5 }, 0, -500, 0, 100)).toEqual({
      x: 0.5,
      y: 1,
    })
  })
})

describe("getCoverSourceRect", () => {
  it("crops the overflowing axis at the pan position", () => {
    expect(getCoverSourceRect(2000, 1000, 100, 100, { x: 1, y: 0.5 })).toEqual({
      sourceX: 1000,
      sourceY: 0,
      sourceWidth: 1000,
      sourceHeight: 1000,
    })
  })
})
