import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react"

import {
  DEFAULT_IMAGE_PAN,
  fitImageStyle,
  getCoverOverflow,
  getFitOverflow,
  objectPosition,
  panFromPointerDelta,
  pansEqual,
  type ImageFit,
  type ImagePan,
} from "@/lib/image-pan"
import { cn } from "@/lib/utils"

const CLICK_MOVE_THRESHOLD_PX = 8

type PointerSession = {
  pointerId: number
  startX: number
  startY: number
  startPan: ImagePan
  overflowX: number
  overflowY: number
  canPan: boolean
  isDragging: boolean
}

type Overflow = {
  overflowX: number
  overflowY: number
}

type PannablePhotoProps = {
  src: string
  pan?: ImagePan
  fit?: ImageFit
  onPanChange?: (pan: ImagePan) => void
  onClick?: () => void
  passthroughHorizontalSwipe?: boolean
  alt?: string
  label?: string
  className?: string
}

export function PannablePhoto({
  src,
  pan = DEFAULT_IMAGE_PAN,
  fit,
  onPanChange,
  onClick,
  passthroughHorizontalSwipe = false,
  alt = "",
  label = "Photo",
  className,
}: PannablePhotoProps) {
  const slotRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const sessionRef = useRef<PointerSession | null>(null)
  const skipClickRef = useRef(false)
  const panRef = useRef(pan)
  const [isDragging, setIsDragging] = useState(false)
  const [overflow, setOverflow] = useState<Overflow>({
    overflowX: 0,
    overflowY: 0,
  })
  const canPan = overflow.overflowX > 1 || overflow.overflowY > 1

  useEffect(() => {
    panRef.current = pan
  }, [pan])

  const measureOverflow = useCallback((): Overflow => {
    const slot = slotRef.current
    const image = imageRef.current
    if (!slot || !image || image.naturalWidth === 0) {
      return { overflowX: 0, overflowY: 0 }
    }

    const rect = slot.getBoundingClientRect()
    return fit
      ? getFitOverflow(
          image.naturalWidth,
          image.naturalHeight,
          rect.width,
          rect.height,
          fit
        )
      : getCoverOverflow(
          image.naturalWidth,
          image.naturalHeight,
          rect.width,
          rect.height
        )
  }, [fit])

  const updateOverflow = useCallback(() => {
    const next = measureOverflow()
    setOverflow((current) =>
      current.overflowX === next.overflowX &&
      current.overflowY === next.overflowY
        ? current
        : next
    )
  }, [measureOverflow])

  useLayoutEffect(() => {
    const slot = slotRef.current
    if (!slot) {
      return
    }

    const observer = new ResizeObserver(() => {
      updateOverflow()
    })
    observer.observe(slot)
    updateOverflow()

    return () => observer.disconnect()
  }, [src, updateOverflow])

  function endSession(pointerId: number) {
    const session = sessionRef.current
    if (!session || session.pointerId !== pointerId) {
      return
    }

    sessionRef.current = null
    setIsDragging(false)

    const slot = slotRef.current
    if (slot?.hasPointerCapture(pointerId)) {
      slot.releasePointerCapture(pointerId)
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return
    }

    const slot = slotRef.current
    const image = imageRef.current
    if (!slot) {
      return
    }

    const wantsClick = Boolean(onClick)
    const wantsPan =
      Boolean(onPanChange) && image != null && image.naturalWidth > 0

    if (!wantsClick && !wantsPan) {
      return
    }

    const nextOverflow = wantsPan ? measureOverflow() : overflow
    const canPanNow = nextOverflow.overflowX > 1 || nextOverflow.overflowY > 1
    if (!wantsClick && !canPanNow) {
      return
    }

    skipClickRef.current = false
    sessionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPan: panRef.current,
      overflowX: nextOverflow.overflowX,
      overflowY: nextOverflow.overflowY,
      canPan: canPanNow && Boolean(onPanChange),
      isDragging: false,
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const session = sessionRef.current
    if (!session || session.pointerId !== event.pointerId) {
      return
    }

    const deltaX = event.clientX - session.startX
    const deltaY = event.clientY - session.startY

    if (!session.isDragging) {
      if (Math.hypot(deltaX, deltaY) < CLICK_MOVE_THRESHOLD_PX) {
        return
      }

      skipClickRef.current = true

      if (passthroughHorizontalSwipe && Math.abs(deltaX) > Math.abs(deltaY)) {
        sessionRef.current = null
        return
      }

      if (!session.canPan || !onPanChange) {
        return
      }

      event.preventDefault()
      slotRef.current?.setPointerCapture(event.pointerId)
      session.isDragging = true
      setIsDragging(true)
    }

    if (!session.isDragging || !onPanChange) {
      return
    }

    event.preventDefault()
    const nextPan = panFromPointerDelta(
      session.startPan,
      event.clientX - session.startX,
      event.clientY - session.startY,
      session.overflowX,
      session.overflowY
    )

    if (!pansEqual(nextPan, panRef.current)) {
      onPanChange(nextPan)
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    endSession(event.pointerId)
  }

  return (
    <div
      ref={slotRef}
      role={onClick ? "button" : "img"}
      tabIndex={onClick ? 0 : undefined}
      aria-label={
        canPan && onClick && fit
          ? `${label}. Drag to reposition, or tap to switch fill.`
          : canPan && onClick
            ? `${label}. Drag to reposition, or tap to replace.`
            : canPan
              ? `${label}. Drag to reposition the visible crop.`
              : onClick && fit
                ? `${label}. Tap to switch between filling width and filling height.`
                : onClick
                  ? `${label}. Tap to replace.`
                  : label
      }
      className={cn(
        "relative size-full overflow-hidden touch-none select-none [-webkit-touch-callout:none]",
        canPan && (isDragging ? "cursor-grabbing" : "cursor-grab"),
        !canPan && onClick && "cursor-pointer",
        className
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={() => {
        if (skipClickRef.current) {
          skipClickRef.current = false
          return
        }

        onClick?.()
      }}
      onKeyDown={(event) => {
        if (!onClick) {
          return
        }

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onClick()
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault()
      }}
      onLostPointerCapture={() => {
        if (sessionRef.current) {
          sessionRef.current = null
          setIsDragging(false)
        }
      }}
    >
      <img
        ref={imageRef}
        alt={alt}
        src={src}
        draggable={false}
        onLoad={updateOverflow}
        className={
          fit
            ? "pointer-events-none absolute max-h-none max-w-none"
            : "pointer-events-none absolute inset-0 size-full max-w-none object-cover"
        }
        style={
          fit
            ? fitImageStyle(fit, pan, overflow.overflowX, overflow.overflowY)
            : { objectPosition: objectPosition(pan) }
        }
      />
    </div>
  )
}
