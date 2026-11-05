import { useCallback, useEffect, useState } from "react"

export type NoticeAction = {
  label: string
  onAction: () => void
}

export type NoticeState = {
  id: number
  message: string
  action?: NoticeAction
}

let nextNoticeId = 1

/** A single short-lived message, replaced by the next one. */
export function useNotice(duration = 5000) {
  const [notice, setNotice] = useState<NoticeState | null>(null)

  useEffect(() => {
    if (!notice) {
      return
    }

    const timer = window.setTimeout(() => {
      setNotice((current) => (current?.id === notice.id ? null : current))
    }, duration)

    return () => {
      window.clearTimeout(timer)
    }
  }, [duration, notice])

  const showNotice = useCallback((message: string, action?: NoticeAction) => {
    setNotice({ id: nextNoticeId++, message, action })
  }, [])

  const dismissNotice = useCallback(() => {
    setNotice(null)
  }, [])

  return { notice, showNotice, dismissNotice }
}
