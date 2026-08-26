import { useLayoutEffect, useRef, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

type FittedFrameProps = {
  children: ReactNode
  className?: string
}

function frameSize(availableWidth: number, availableHeight: number) {
  if (availableWidth <= 0 || availableHeight <= 0) {
    return { width: 0, height: 0, left: 0, top: 0 }
  }

  let width = Math.min(availableWidth, (availableHeight * 9) / 16)
  let height = Math.min(availableHeight, (availableWidth * 16) / 9)
  width = Math.floor(width)
  height = Math.round((width * 16) / 9)

  if (height > availableHeight) {
    height = Math.floor(availableHeight)
    width = Math.round((height * 9) / 16)
  }

  return {
    width,
    height,
    left: Math.floor((availableWidth - width) / 2),
    top: Math.floor((availableHeight - height) / 2),
  }
}

export function FittedFrame({ children, className }: FittedFrameProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({
    width: 0,
    height: 0,
    left: 0,
    top: 0,
  })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) {
      return
    }

    function measure() {
      const next = frameSize(el.clientWidth, el.clientHeight)
      setSize((current) =>
        current.width === next.width &&
        current.height === next.height &&
        current.left === next.left &&
        current.top === next.top
          ? current
          : next
      )
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const ready = size.width > 0 && size.height > 0

  return (
    <div className={cn("h-full min-h-0 w-full", className)}>
      <div ref={ref} className="relative h-full min-h-0 w-full">
        <div
          className="absolute max-h-full max-w-full"
          style={
            ready
              ? {
                  width: size.width,
                  height: size.height,
                  left: size.left,
                  top: size.top,
                }
              : { width: "100%", aspectRatio: "9 / 16", maxHeight: "100%" }
          }
        >
          {children}
        </div>
      </div>
    </div>
  )
}
