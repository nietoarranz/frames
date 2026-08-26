import {
  useCallback,
  useRef,
  useState,
  type ComponentProps,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { ImagePlus, Pipette, X } from "lucide-react"
import { Color, useColorState } from "react-beautiful-color"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  BackgroundMode,
  FrameBackground,
  LoadedSlotPhoto,
} from "@/lib/collection-draft"
import { cn } from "@/lib/utils"

type FrameBackgroundPickerProps = {
  value: string
  onChange: (hex: string) => void
}

type FrameBackgroundImagePickerProps = {
  image: LoadedSlotPhoto | null
  onSelect: (file: File) => void
  onRemove: () => void
}

type FrameBackgroundEditorProps = {
  background: FrameBackground
  onModeChange: (mode: BackgroundMode) => void
  onColorChange: (hex: string) => void
  onImageSelect: (file: File) => void
  onImageRemove: () => void
}

function isImageFile(file: File | undefined): file is File {
  return Boolean(file?.type.startsWith("image/"))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function positionFromPointer(event: ReactPointerEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect()
  return {
    x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
  }
}

type ColorDragAreaProps = Omit<ComponentProps<"div">, "onDrag"> & {
  onDrag: (x: number, y: number) => void
  onDragChange?: (dragging: boolean) => void
}

function ColorDragArea({
  className,
  onDrag,
  onDragChange,
  children,
  style,
  ...props
}: ColorDragAreaProps) {
  function updateFromPointer(event: ReactPointerEvent<HTMLElement>) {
    const { x, y } = positionFromPointer(event)
    onDrag(x, y)
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      {...props}
      className={cn("touch-none select-none", className)}
      style={{ touchAction: "none", ...style }}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (!event.isPrimary) return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        onDragChange?.(true)
        updateFromPointer(event)
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
        event.preventDefault()
        updateFromPointer(event)
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
        onDragChange?.(false)
      }}
      onPointerCancel={() => {
        onDragChange?.(false)
      }}
      onLostPointerCapture={() => {
        onDragChange?.(false)
      }}
    >
      {children}
    </div>
  )
}

function ColorPointer({ left, top }: { left: number; top: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-[1] size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
      style={{ left: `${left * 100}%`, top: `${top * 100}%` }}
    />
  )
}

export function FrameBackgroundPicker({
  value,
  onChange,
}: FrameBackgroundPickerProps) {
  const [{ colorState }, setColor] = useColorState({
    type: "hex",
    value,
  })
  const [hasEyeDropper] = useState(
    () => typeof window !== "undefined" && "EyeDropper" in window
  )
  const isDraggingRef = useRef(false)
  const hsva = colorState.hsva

  const commitHsva = useCallback(
    (next: { h?: number; s?: number; v?: number }) => {
      const color = new Color({
        type: "hsva",
        h: next.h ?? hsva.h,
        s: next.s ?? hsva.s,
        v: next.v ?? hsva.v,
        a: hsva.a,
      })
      setColor(color)
      onChange(color.getHex())
    },
    [hsva.a, hsva.h, hsva.s, hsva.v, onChange, setColor]
  )

  function setDragging(dragging: boolean) {
    isDraggingRef.current = dragging
  }

  async function handleEyeDropper() {
    const EyeDropperCtor = (
      window as Window & {
        EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> }
      }
    ).EyeDropper
    if (!EyeDropperCtor) return

    try {
      const result = await new EyeDropperCtor().open()
      if (!result.sRGBHex) return
      const color = new Color({ type: "hex", value: result.sRGBHex })
      setColor(color)
      onChange(color.getHex())
    } catch {
      // User cancelled the eye dropper.
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 w-full justify-start gap-2.5"
          aria-label="Background color"
        >
          <span
            aria-hidden
            className="size-5 rounded-md ring-1 ring-foreground/15"
            style={{ backgroundColor: colorState.hex }}
          />
          <span className="font-mono text-xs uppercase">{colorState.hex}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[17.5rem] touch-none p-3"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => {
          if (isDraggingRef.current) event.preventDefault()
        }}
        onFocusOutside={(event) => {
          if (isDraggingRef.current) event.preventDefault()
        }}
      >
        <ColorDragArea
          className="relative mb-3 h-36 cursor-crosshair rounded-lg"
          aria-label="Color"
          aria-valuetext={`Saturation ${Math.round(hsva.s)}%, Brightness ${Math.round(hsva.v)}%`}
          onDragChange={setDragging}
          onDrag={(x, y) => {
            commitHsva({
              s: x * 100,
              v: (1 - y) * 100,
            })
          }}
          onKeyDown={(event) => {
            const step = event.shiftKey ? 10 : 2
            if (event.key === "ArrowRight") {
              event.preventDefault()
              commitHsva({ s: clamp(hsva.s + step, 0, 100) })
            } else if (event.key === "ArrowLeft") {
              event.preventDefault()
              commitHsva({ s: clamp(hsva.s - step, 0, 100) })
            } else if (event.key === "ArrowUp") {
              event.preventDefault()
              commitHsva({ v: clamp(hsva.v + step, 0, 100) })
            } else if (event.key === "ArrowDown") {
              event.preventDefault()
              commitHsva({ v: clamp(hsva.v - step, 0, 100) })
            }
          }}
        >
          <div
            className="absolute inset-0 rounded-lg"
            style={{
              backgroundColor: `hsl(${hsva.h}, 100%, 50%)`,
              backgroundImage:
                "linear-gradient(to top, #000, rgba(0, 0, 0, 0)), linear-gradient(to right, #fff, rgba(255, 255, 255, 0))",
              boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.05)",
            }}
          />
          <ColorPointer left={hsva.s / 100} top={1 - hsva.v / 100} />
        </ColorDragArea>
        <div className="flex items-center gap-3">
          {hasEyeDropper ? (
            <button
              type="button"
              title="Pick color from screen"
              className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-muted"
              onClick={() => {
                void handleEyeDropper()
              }}
            >
              <Pipette className="size-4" />
            </button>
          ) : null}
          <ColorDragArea
            className="relative h-4 min-w-0 flex-1 cursor-ew-resize rounded-lg"
            aria-label="Hue"
            aria-valuemin={0}
            aria-valuemax={360}
            aria-valuenow={Math.round(hsva.h)}
            onDragChange={setDragging}
            onDrag={(x) => {
              commitHsva({ h: x * 360 })
            }}
            onKeyDown={(event) => {
              const step = event.shiftKey ? 10 : 2
              if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                event.preventDefault()
                commitHsva({ h: clamp(hsva.h + step, 0, 360) })
              } else if (
                event.key === "ArrowLeft" ||
                event.key === "ArrowDown"
              ) {
                event.preventDefault()
                commitHsva({ h: clamp(hsva.h - step, 0, 360) })
              }
            }}
          >
            <div
              className="absolute inset-0 rounded-lg"
              style={{
                background:
                  "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
              }}
            />
            <ColorPointer left={hsva.h / 360} top={0.5} />
          </ColorDragArea>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function FrameBackgroundImagePicker({
  image,
  onSelect,
  onRemove,
}: FrameBackgroundImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFiles(files: FileList | null) {
    const file = files?.[0]
    if (!isImageFile(file)) {
      return
    }

    onSelect(file)
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          handleFiles(event.target.files)
          event.target.value = ""
        }}
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-9 min-w-0 flex-1 justify-start gap-2.5"
          aria-label={
            image ? "Replace background image" : "Choose background image"
          }
          onClick={() => {
            inputRef.current?.click()
          }}
        >
          {image ? (
            <span
              aria-hidden
              className="size-5 shrink-0 overflow-hidden rounded-md ring-1 ring-foreground/15"
            >
              <img alt="" src={image.url} className="size-full object-cover" />
            </span>
          ) : (
            <ImagePlus className="size-4 shrink-0" />
          )}
          <span className="truncate text-xs">
            {image ? image.file.name : "Choose image"}
          </span>
        </Button>
        {image ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0"
            aria-label="Remove background image"
            onClick={onRemove}
          >
            <X />
          </Button>
        ) : null}
      </div>
      {image ? (
        <p className="text-xs text-muted-foreground">
          Drag the background on the story to reposition it.
        </p>
      ) : null}
    </div>
  )
}

export function FrameBackgroundEditor({
  background,
  onModeChange,
  onColorChange,
  onImageSelect,
  onImageRemove,
}: FrameBackgroundEditorProps) {
  return (
    <div className="flex flex-col gap-3">
      <Tabs
        value={background.mode}
        onValueChange={(value) => {
          if (value === "color" || value === "image") {
            onModeChange(value)
          }
        }}
      >
        <TabsList className="w-full">
          <TabsTrigger value="color" className="flex-1">
            Color
          </TabsTrigger>
          <TabsTrigger value="image" className="flex-1">
            Image
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {background.mode === "image" ? (
        <FrameBackgroundImagePicker
          image={background.image}
          onSelect={onImageSelect}
          onRemove={onImageRemove}
        />
      ) : (
        <FrameBackgroundPicker
          value={background.color}
          onChange={onColorChange}
        />
      )}
    </div>
  )
}
