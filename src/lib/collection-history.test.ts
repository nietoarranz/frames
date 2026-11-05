import { describe, expect, it } from "vitest"

import {
  COALESCE_MS,
  commitHistory,
  createHistory,
  HISTORY_LIMIT,
  redoHistory,
  replacePresent,
  undoHistory,
} from "@/lib/collection-history"

describe("history", () => {
  it("undoes and redoes commits in order", () => {
    let history = createHistory("a")
    history = commitHistory(history, "b")
    history = commitHistory(history, "c")

    history = undoHistory(history)
    expect(history.present).toBe("b")
    history = undoHistory(history)
    expect(history.present).toBe("a")
    expect(undoHistory(history)).toBe(history)

    history = redoHistory(history)
    expect(history.present).toBe("b")
  })

  it("drops the redo stack on a new commit", () => {
    let history = commitHistory(createHistory("a"), "b")
    history = undoHistory(history)
    history = commitHistory(history, "c")

    expect(history.future).toEqual([])
    expect(redoHistory(history)).toBe(history)
  })

  it("ignores commits that change nothing", () => {
    const history = createHistory("a")
    expect(commitHistory(history, "a")).toBe(history)
  })

  it("merges rapid changes with the same key into one step", () => {
    let history = createHistory(0)
    history = commitHistory(history, 1, { key: "drag", now: 1000 })
    history = commitHistory(history, 2, { key: "drag", now: 1100 })
    history = commitHistory(history, 3, { key: "drag", now: 1200 })

    expect(history.past).toEqual([0])
    expect(undoHistory(history).present).toBe(0)
  })

  it("starts a new step after a pause or a different key", () => {
    let history = createHistory(0)
    history = commitHistory(history, 1, { key: "drag", now: 0 })
    history = commitHistory(history, 2, { key: "drag", now: COALESCE_MS })
    history = commitHistory(history, 3, { key: "other", now: COALESCE_MS })

    expect(history.past).toEqual([0, 1, 2])
  })

  it("does not merge into a step that was just undone to", () => {
    let history = createHistory(0)
    history = commitHistory(history, 1, { key: "drag", now: 0 })
    history = undoHistory(history)
    history = commitHistory(history, 2, { key: "drag", now: 10 })

    expect(history.past).toEqual([0])
  })

  it("keeps at most HISTORY_LIMIT undo steps", () => {
    let history = createHistory(0)
    for (let value = 1; value <= HISTORY_LIMIT + 10; value++) {
      history = commitHistory(history, value)
    }

    expect(history.past).toHaveLength(HISTORY_LIMIT)
    expect(history.past[0]).toBe(10)
  })

  it("replaces the present without adding an undo step", () => {
    let history = commitHistory(createHistory("a"), "b")
    history = replacePresent(history, "b2")

    expect(history.past).toEqual(["a"])
    expect(history.present).toBe("b2")
  })
})
