import { useCallback, useEffect, useRef, useState } from "react"

import type { CollectionStoryState } from "@/lib/collection-draft"
import {
  composeStoryFile,
  isStoryReady,
  uniqueFilenames,
} from "@/lib/collection-editor"
import { shareFiles } from "@/lib/story"

type PreparedExport = {
  story: CollectionStoryState
  file: File
}

/**
 * Keeps an exported file ready for every finished story, so the share sheet
 * opens straight from the click (iOS needs it inside the user gesture).
 * Stories are immutable, so a changed object means a stale export.
 */
export function useStoryExports(
  stories: CollectionStoryState[],
  activeIndex: number
) {
  const preparedRef = useRef(new Map<string, PreparedExport>())
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    const prepared = preparedRef.current
    const ids = new Set(stories.map((story) => story.id))
    for (const id of prepared.keys()) {
      if (!ids.has(id)) {
        prepared.delete(id)
      }
    }

    // The active story first: it's the one most likely to be downloaded.
    const active = stories[activeIndex]
    const queue = active
      ? [active, ...stories.filter((story) => story !== active)]
      : stories
    let cancelled = false

    const timer = window.setTimeout(async () => {
      for (const story of queue) {
        if (cancelled) {
          return
        }

        if (!isStoryReady(story)) {
          prepared.delete(story.id)
          continue
        }

        if (prepared.get(story.id)?.story === story) {
          continue
        }

        try {
          const file = await composeStoryFile(story)
          if (!cancelled) {
            prepared.set(story.id, { story, file })
          }
        } catch {
          prepared.delete(story.id)
        }
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [activeIndex, stories])

  const fileFor = useCallback(async (story: CollectionStoryState) => {
    const prepared = preparedRef.current.get(story.id)
    return prepared?.story === story ? prepared.file : composeStoryFile(story)
  }, [])

  /**
   * Shares or downloads every finished story among `targets`.
   * Returns how many were skipped because they still have empty slots.
   */
  const exportStories = useCallback(
    async (targets: CollectionStoryState[]) => {
      const ready = targets.filter(isStoryReady)
      if (ready.length === 0) {
        return targets.length
      }

      const allPrepared = ready.every(
        (story) => preparedRef.current.get(story.id)?.story === story
      )
      if (!allPrepared) {
        setIsExporting(true)
      }

      try {
        const files = await Promise.all(ready.map(fileFor))
        const names = uniqueFilenames(files.map((file) => file.name))
        await shareFiles(
          files.map((file, index) =>
            file.name === names[index]
              ? file
              : new File([file], names[index], { type: file.type })
          )
        )
      } finally {
        setIsExporting(false)
      }

      return targets.length - ready.length
    },
    [fileFor]
  )

  return { isExporting, exportStories }
}
