import {
  getFrameSlotRects,
  type CollectionFrameDesign,
} from "@/lib/collection-frames"
import { cn } from "@/lib/utils"

type CollectionFramePreviewProps = {
  design: CollectionFrameDesign
  className?: string
}

export function CollectionFramePreview({
  design,
  className,
}: CollectionFramePreviewProps) {
  const clipId = `frame-preview-${design.id}`
  const slots = getFrameSlotRects(design)
  const radius = design.width * 0.08
  const slotRadius = Math.min(design.width, design.height) * 0.02

  return (
    <svg
      viewBox={`0 0 ${design.width} ${design.height}`}
      width={design.width}
      height={design.height}
      className={cn("h-28 w-auto", className)}
      aria-hidden
    >
      <defs>
        <clipPath id={clipId}>
          <rect width={design.width} height={design.height} rx={radius} />
        </clipPath>
      </defs>
      <rect
        width={design.width}
        height={design.height}
        rx={radius}
        fill="#ffffff"
      />
      <g clipPath={`url(#${clipId})`}>
        {slots.map((slot) => (
          <rect
            key={slot.id}
            x={slot.x}
            y={slot.y}
            width={slot.width}
            height={slot.height}
            rx={slotRadius}
            fill="#d4d4d4"
            stroke="#737373"
            strokeWidth={5}
            vectorEffect="nonScalingStroke"
          />
        ))}
      </g>
    </svg>
  )
}
