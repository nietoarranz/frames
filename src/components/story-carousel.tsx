import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"

import { cn } from "@/lib/utils"

const SWIPE_LOCK_PX = 12
const SNAP_RATIO = 0.22
const FLICK_VELOCITY = 0.45
const WHEEL_COOLDOWN_MS = 420
const RUBBER_BAND = 0.32

type SwipeSession = {
  pointerId: number
  startX: number
  startY: number
  lastX: number
  lastTime: number
  velocity: number
  locked: boolean
  isSwipe: boolean
}

type StoryCarouselProps = {
  index: number
  onIndexChange: (index: number) => void
  children: ReactNode
}

function clampIndex(index: number, count: number) {
  return Math.min(Math.max(index, 0), Math.max(count - 1, 0))
}

export function StoryCarousel({
  index,
  onIndexChange,
  children,
}: StoryCarouselProps) {
  const slides = Children.toArray(children)
  const count = slides.length
  const canSwipe = count > 1
  const viewportRef = useRef<HTMLDivElement>(null)
  const sessionRef = useRef<SwipeSession | null>(null)
  const wheelLockRef = useRef(0)
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const goTo = useCallback(
    (nextIndex: number) => {
      onIndexChange(clampIndex(nextIndex, count))
    },
    [count, onIndexChange]
  )

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !canSwipe) {
      return
    }

    function handleWheel(event: WheelEvent) {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) {
        return
      }

      event.preventDefault()
      const now = performance.now()
      if (now - wheelLockRef.current < WHEEL_COOLDOWN_MS) {
        return
      }

      if (Math.abs(event.deltaX) < 8) {
        return
      }

      wheelLockRef.current = now
      goTo(index + (event.deltaX > 0 ? 1 : -1))
    }

    viewport.addEventListener("wheel", handleWheel, { passive: false })
    return () => {
      viewport.removeEventListener("wheel", handleWheel)
    }
  }, [canSwipe, goTo, index])

  function resistedDrag(deltaX: number) {
    if (index <= 0 && deltaX > 0) {
      return deltaX * RUBBER_BAND
    }

    if (index >= count - 1 && deltaX < 0) {
      return deltaX * RUBBER_BAND
    }

    return deltaX
  }

  function endSession(pointerId: number) {
    const session = sessionRef.current
    if (!session || session.pointerId !== pointerId) {
      return
    }

    const viewport = viewportRef.current
    const width = viewport?.clientWidth ?? 1
    const offset = resistedDrag(session.lastX - session.startX)

    if (session.isSwipe) {
      let nextIndex = index
      if (offset <= -width * SNAP_RATIO || session.velocity < -FLICK_VELOCITY) {
        nextIndex = index + 1
      } else if (
        offset >= width * SNAP_RATIO ||
        session.velocity > FLICK_VELOCITY
      ) {
        nextIndex = index - 1
      }

      goTo(nextIndex)
    }

    sessionRef.current = null
    setDragX(0)
    setIsDragging(false)

    if (viewport?.hasPointerCapture(pointerId)) {
      viewport.releasePointerCapture(pointerId)
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!canSwipe || (event.pointerType === "mouse" && event.button !== 0)) {
      return
    }

    sessionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      velocity: 0,
      locked: false,
      isSwipe: false,
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const session = sessionRef.current
    if (!session || session.pointerId !== event.pointerId) {
      return
    }

    const deltaX = event.clientX - session.startX
    const deltaY = event.clientY - session.startY
    const elapsed = event.timeStamp - session.lastTime
    if (elapsed > 0) {
      session.velocity = (event.clientX - session.lastX) / elapsed
    }
    session.lastX = event.clientX
    session.lastTime = event.timeStamp

    if (!session.locked) {
      if (Math.hypot(deltaX, deltaY) < SWIPE_LOCK_PX) {
        return
      }

      session.locked = true
      session.isSwipe = Math.abs(deltaX) > Math.abs(deltaY)
      if (!session.isSwipe) {
        return
      }

      event.preventDefault()
      viewportRef.current?.setPointerCapture(event.pointerId)
      setIsDragging(true)
    }

    if (!session.isSwipe) {
      return
    }

    event.preventDefault()
    setDragX(resistedDrag(deltaX))
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    endSession(event.pointerId)
  }

  const offsetTrack = canSwipe || isDragging || dragX !== 0

  return (
    <div className="relative h-full min-h-0 w-full">
      <div
        ref={viewportRef}
        className="h-full min-h-0 w-full touch-none overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onLostPointerCapture={handlePointerUp}
      >
        <div
          className="flex h-full w-full"
          style={
            offsetTrack
              ? {
                  transform: `translate3d(calc(${-index * 100}% + ${dragX}px), 0, 0)`,
                  transition: isDragging
                    ? "none"
                    : "transform 320ms cubic-bezier(0.32, 0.72, 0, 1)",
                }
              : undefined
          }
        >
          {slides.map((slide, slideIndex) => (
            <div
              key={
                isValidElement(slide) && slide.key != null
                  ? slide.key
                  : slideIndex
              }
              className="h-full w-full shrink-0"
              aria-hidden={slideIndex !== index}
            >
              {slide}
            </div>
          ))}
        </div>
      </div>

      {canSwipe ? (
        <div
          role="tablist"
          aria-label="Stories"
          className="pointer-events-none absolute inset-x-0 bottom-1 z-10 flex items-center justify-center"
        >
          <div className="flex items-center gap-1.5 rounded-full bg-black/40 px-2 py-1.5 backdrop-blur-sm">
            {slides.map((_, slideIndex) => {
              const selected = slideIndex === index

              return (
                <button
                  key={slideIndex}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-label={`Story ${slideIndex + 1} of ${count}`}
                  className="pointer-events-auto flex size-4 items-center justify-center"
                  onClick={() => {
                    goTo(slideIndex)
                  }}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full transition-all",
                      selected ? "scale-125 bg-white" : "bg-white/45"
                    )}
                  />
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
