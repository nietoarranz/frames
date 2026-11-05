export const HISTORY_LIMIT = 50
/** Changes with the same key within this window merge into one undo step. */
export const COALESCE_MS = 1000

export type History<T> = {
  past: T[]
  present: T
  future: T[]
  lastKey: string | null
  lastTime: number
}

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastKey: null, lastTime: 0 }
}

/**
 * Records a new present. Rapid changes that share a `key` (a drag, a slider)
 * collapse into a single undo step.
 */
export function commitHistory<T>(
  history: History<T>,
  next: T,
  { key = null, now = 0 }: { key?: string | null; now?: number } = {}
): History<T> {
  if (next === history.present) {
    return history
  }

  const coalesce =
    key !== null &&
    key === history.lastKey &&
    now - history.lastTime < COALESCE_MS

  return {
    past: coalesce
      ? history.past
      : [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
    lastKey: key,
    lastTime: now,
  }
}

/** Changes the present without recording an undo step (e.g. navigation). */
export function replacePresent<T>(history: History<T>, next: T): History<T> {
  return next === history.present ? history : { ...history, present: next }
}

export function undoHistory<T>(history: History<T>): History<T> {
  const previous = history.past.at(-1)
  if (previous === undefined) {
    return history
  }

  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    lastKey: null,
    lastTime: 0,
  }
}

export function redoHistory<T>(history: History<T>): History<T> {
  const [next, ...future] = history.future
  if (next === undefined) {
    return history
  }

  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future,
    lastKey: null,
    lastTime: 0,
  }
}

export function historySnapshots<T>(history: History<T>) {
  return [...history.past, history.present, ...history.future]
}
