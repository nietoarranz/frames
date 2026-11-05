import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { NoticeState } from "@/hooks/use-notice"
import { cn } from "@/lib/utils"

type NoticeProps = {
  notice: NoticeState | null
  onDismiss: () => void
  className?: string
}

export function Notice({ notice, onDismiss, className }: NoticeProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("pointer-events-none flex justify-center px-4", className)}
    >
      {notice ? (
        <div
          key={notice.id}
          className="pointer-events-auto flex max-w-sm animate-in items-center gap-1 rounded-full border bg-popover py-1 pr-1 pl-4 text-sm text-popover-foreground shadow-lg fade-in-0 slide-in-from-bottom-2"
        >
          <span className="min-w-0 py-1">{notice.message}</span>
          {notice.action ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 rounded-full font-semibold"
              onClick={() => {
                notice.action?.onAction()
                onDismiss()
              }}
            >
              {notice.action.label}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 rounded-full"
            aria-label="Dismiss"
            onClick={onDismiss}
          >
            <X />
          </Button>
        </div>
      ) : null}
    </div>
  )
}
