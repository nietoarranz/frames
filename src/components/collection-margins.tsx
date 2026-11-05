import { Lock, RotateCcw, Unlock } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import type {
  CollectionFramePadding,
  CollectionFrameSpacing,
} from "@/lib/collection-frames"
import { cn } from "@/lib/utils"

type CollectionMarginsProps = {
  width: number
  height: number
  spacing: CollectionFrameSpacing
  defaults: CollectionFrameSpacing
  showGap: boolean
  onSpacingChange: (spacing: CollectionFrameSpacing) => void
}

function spacingEquals(a: CollectionFrameSpacing, b: CollectionFrameSpacing) {
  return (
    a.gap === b.gap &&
    a.linkHorizontal === b.linkHorizontal &&
    a.linkVertical === b.linkVertical &&
    a.padding.top === b.padding.top &&
    a.padding.right === b.padding.right &&
    a.padding.bottom === b.padding.bottom &&
    a.padding.left === b.padding.left
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)))
}

function NumberField({
  id,
  value,
  min,
  max,
  onChange,
}: {
  id: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  // A draft only applies to the value it was typed against, so outside
  // changes (slider, undo) replace it without an effect.
  const [draft, setDraft] = useState<{ text: string; base: number } | null>(
    null
  )

  function commit(raw: string) {
    const parsed = Number.parseInt(raw, 10)
    if (Number.isNaN(parsed)) {
      setDraft(null)
      return
    }
    onChange(clamp(parsed, min, max))
    setDraft(null)
  }

  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      value={draft?.base === value ? draft.text : String(value)}
      onFocus={(event) => {
        event.currentTarget.select()
      }}
      onChange={(event) => {
        setDraft({ text: event.target.value, base: value })
      }}
      onBlur={(event) => {
        commit(event.target.value)
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault()
          commit(event.currentTarget.value)
          event.currentTarget.blur()
        }
      }}
      className="h-7 w-14 shrink-0 px-1.5 text-center font-mono text-xs tabular-nums"
    />
  )
}

function MarginRow({
  id,
  label,
  value,
  min,
  max,
  linked,
  onChange,
  onToggleLink,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  linked?: boolean
  onChange: (value: number) => void
  onToggleLink?: () => void
}) {
  return (
    <div className="grid grid-cols-[5.75rem_3.5rem_minmax(0,1fr)_1.75rem] items-center gap-2">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <NumberField
        id={id}
        value={value}
        min={min}
        max={max}
        onChange={onChange}
      />
      <Slider
        min={min}
        max={max}
        step={1}
        value={[value]}
        onValueChange={(next) => {
          onChange(next[0] ?? value)
        }}
        aria-label={label}
      />
      {onToggleLink ? (
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-pressed={linked}
          aria-label={
            linked
              ? `Unlock ${label.toLowerCase()} to adjust separately`
              : `Lock ${label.toLowerCase()} together`
          }
          title={linked ? "Adjust separately" : "Keep equal"}
          onClick={onToggleLink}
          className={cn(linked && "text-foreground")}
        >
          {linked ? <Lock /> : <Unlock />}
        </Button>
      ) : (
        <span aria-hidden />
      )}
    </div>
  )
}

export function CollectionMargins({
  width,
  height,
  spacing,
  defaults,
  showGap,
  onSpacingChange,
}: CollectionMarginsProps) {
  const maxHorizontal = Math.floor(width / 2)
  const maxVertical = Math.floor(height / 2)
  const { padding, gap, linkHorizontal } = spacing
  const isOriginal = spacingEquals(spacing, defaults)

  function updatePadding(next: Partial<CollectionFramePadding>) {
    onSpacingChange({
      ...spacing,
      padding: { ...padding, ...next },
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="shrink-0"
          disabled={isOriginal}
          onClick={() => {
            onSpacingChange({
              padding: { ...defaults.padding },
              gap: defaults.gap,
              linkHorizontal: defaults.linkHorizontal,
              linkVertical: defaults.linkVertical,
            })
          }}
        >
          <RotateCcw data-icon="inline-start" />
          Reset
        </Button>
      </div>
      <div className="space-y-2.5">
        {linkHorizontal ? (
          <MarginRow
            id="margin-horizontal"
            label="Left & right"
            value={padding.left}
            min={0}
            max={maxHorizontal}
            linked
            onChange={(value) => {
              updatePadding({ left: value, right: value })
            }}
            onToggleLink={() => {
              onSpacingChange({ ...spacing, linkHorizontal: false })
            }}
          />
        ) : (
          <>
            <MarginRow
              id="margin-left"
              label="Left"
              value={padding.left}
              min={0}
              max={maxHorizontal}
              linked={false}
              onChange={(value) => {
                updatePadding({ left: value })
              }}
              onToggleLink={() => {
                onSpacingChange({
                  ...spacing,
                  linkHorizontal: true,
                  padding: { ...padding, right: padding.left },
                })
              }}
            />
            <MarginRow
              id="margin-right"
              label="Right"
              value={padding.right}
              min={0}
              max={maxHorizontal}
              onChange={(value) => {
                updatePadding({ right: value })
              }}
            />
          </>
        )}

        {showGap ? (
          <MarginRow
            id="margin-gap"
            label="Gap"
            value={gap}
            min={0}
            max={maxVertical}
            onChange={(value) => {
              onSpacingChange({ ...spacing, gap: value })
            }}
          />
        ) : null}
      </div>
    </div>
  )
}
