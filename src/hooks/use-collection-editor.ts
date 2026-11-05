import { useCallback, useEffect, useReducer, useRef, useState } from "react"

import {
  collectionDraftFromState,
  createEmptyCollectionStory,
  restoreCollectionDraft,
  revokeCollectionStories,
  saveCollectionDraft,
  type CollectionStoryState,
} from "@/lib/collection-draft"
import {
  collectObjectUrls,
  updateStory as updateStoryInState,
  type EditorState,
} from "@/lib/collection-editor"
import {
  commitHistory,
  createHistory,
  historySnapshots,
  redoHistory,
  replacePresent,
  undoHistory,
  type History,
} from "@/lib/collection-history"

type EditorAction =
  | {
      type: "commit"
      update: (state: EditorState) => EditorState
      key?: string
      now: number
    }
  | { type: "navigate"; index: number }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "restore"; state: EditorState }

function editorReducer(
  history: History<EditorState>,
  action: EditorAction
): History<EditorState> {
  switch (action.type) {
    case "commit":
      return commitHistory(history, action.update(history.present), {
        key: action.key,
        now: action.now,
      })
    case "navigate": {
      const { present } = history
      const index = Math.min(
        Math.max(action.index, 0),
        present.stories.length - 1
      )
      return index === present.activeIndex
        ? history
        : replacePresent(history, { ...present, activeIndex: index })
    }
    case "undo":
      return undoHistory(history)
    case "redo":
      return redoHistory(history)
    case "restore":
      return createHistory(action.state)
  }
}

function initialHistory() {
  return createHistory<EditorState>({
    stories: [createEmptyCollectionStory()],
    activeIndex: 0,
  })
}

/**
 * Story editor state with undo/redo, draft persistence in IndexedDB, and
 * object URL cleanup once no undo step can reach a photo any more.
 */
export function useCollectionEditor() {
  const [history, dispatch] = useReducer(
    editorReducer,
    undefined,
    initialHistory
  )
  const [draftReady, setDraftReady] = useState(false)
  const state = history.present
  const stateRef = useRef(state)
  const draftReadyRef = useRef(false)
  const trackedUrlsRef = useRef(new Set<string>())

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    let cancelled = false

    void restoreCollectionDraft().then((draft) => {
      if (cancelled) {
        if (draft) {
          revokeCollectionStories(draft.stories)
        }
        return
      }

      if (draft) {
        stateRef.current = draft
        dispatch({ type: "restore", state: draft })
      }

      draftReadyRef.current = true
      setDraftReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!draftReady) {
      return
    }

    const timer = window.setTimeout(() => {
      void saveCollectionDraft(collectionDraftFromState(stateRef.current))
    }, 250)

    return () => {
      window.clearTimeout(timer)
    }
  }, [draftReady, state])

  useEffect(() => {
    function flushDraft() {
      if (!draftReadyRef.current) {
        return
      }

      void saveCollectionDraft(collectionDraftFromState(stateRef.current))
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        flushDraft()
      }
    }

    window.addEventListener("pagehide", flushDraft)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    document.addEventListener("freeze", flushDraft)

    return () => {
      window.removeEventListener("pagehide", flushDraft)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      document.removeEventListener("freeze", flushDraft)
    }
  }, [])

  useEffect(() => {
    const tracked = trackedUrlsRef.current
    const reachable = new Set<string>()
    for (const snapshot of historySnapshots(history)) {
      collectObjectUrls(snapshot.stories, reachable)
    }

    for (const url of tracked) {
      if (!reachable.has(url)) {
        URL.revokeObjectURL(url)
        tracked.delete(url)
      }
    }
    for (const url of reachable) {
      tracked.add(url)
    }
  }, [history])

  useEffect(() => {
    const tracked = trackedUrlsRef.current

    return () => {
      for (const url of tracked) {
        URL.revokeObjectURL(url)
      }
      tracked.clear()
    }
  }, [])

  const commit = useCallback(
    (update: (state: EditorState) => EditorState, key?: string) => {
      dispatch({ type: "commit", update, key, now: Date.now() })
    },
    []
  )

  const updateStory = useCallback(
    (
      storyId: string,
      updater: (story: CollectionStoryState) => CollectionStoryState,
      key?: string
    ) => {
      commit((current) => updateStoryInState(current, storyId, updater), key)
    },
    [commit]
  )

  const setActiveIndex = useCallback((index: number) => {
    dispatch({ type: "navigate", index })
  }, [])

  const undo = useCallback(() => dispatch({ type: "undo" }), [])
  const redo = useCallback(() => dispatch({ type: "redo" }), [])
  const getState = useCallback(() => stateRef.current, [])

  return {
    stories: state.stories,
    activeIndex: state.activeIndex,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    commit,
    updateStory,
    setActiveIndex,
    undo,
    redo,
    getState,
  }
}
