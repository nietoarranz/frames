import { describe, expect, it } from "vitest"

import {
  getCollectionFrame,
  getFrameSlotRects,
  spacingFromFrame,
  uniformPadding,
} from "@/lib/collection-frames"

describe("getFrameSlotRects", () => {
  it("centers a single slot inside the padding", () => {
    const frame = getCollectionFrame("portrait")
    const [slot] = getFrameSlotRects(frame)
    const below = frame.height - (slot.y + slot.height)

    expect(slot.x).toBe(80)
    expect(slot.width).toBe(920)
    expect(slot.height).toBeCloseTo((920 * 4096) / 2723)
    expect(slot.y).toBeCloseTo(below)
  })

  it("stacks slots with the gap between them", () => {
    const [first, second] = getFrameSlotRects(getCollectionFrame("stack"))

    expect(second.y - (first.y + first.height)).toBeCloseTo(80)
  })

  it("fills the frame edge to edge without padding", () => {
    const rects = getFrameSlotRects(getCollectionFrame("strip"))

    expect(rects.map((rect) => rect.y)).toEqual([0, 640, 1280])
    expect(rects.every((rect) => rect.width === 1080)).toBe(true)
  })

  it("overflows equally above and below when the stack is too tall", () => {
    const rects = getFrameSlotRects({
      ...getCollectionFrame("strip"),
      gap: 200,
    })
    const last = rects[rects.length - 1]

    expect(rects[0].y).toBe(-200)
    expect(last.y + last.height).toBe(1920 + 200)
  })

  it("never returns a negative width", () => {
    const [slot] = getFrameSlotRects({
      ...getCollectionFrame("portrait"),
      padding: uniformPadding(600),
    })

    expect(slot.width).toBe(1)
  })
})

describe("spacingFromFrame", () => {
  it("copies the frame padding so edits don't touch the design", () => {
    const frame = getCollectionFrame("portrait")
    const spacing = spacingFromFrame(frame)
    spacing.padding.left = 0

    expect(frame.padding.left).toBe(80)
    expect(spacing).toMatchObject({ gap: 0, linkHorizontal: true })
  })
})
