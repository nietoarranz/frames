import { describe, expect, it } from "vitest"

import {
  createEmptyCollectionStory,
  type LoadedSlotPhoto,
} from "@/lib/collection-draft"
import {
  collectObjectUrls,
  insertStory,
  isStoryReady,
  removeStory,
  storyFilename,
  uniqueFilenames,
  withFrame,
  withPan,
  withPhoto,
  withTransparentToggled,
  type EditorState,
} from "@/lib/collection-editor"

function fakePhoto(
  name: string,
  width: number,
  height: number
): LoadedSlotPhoto {
  return {
    file: new File([], name),
    url: `blob:${name}`,
    image: { naturalWidth: width, naturalHeight: height } as HTMLImageElement,
  }
}

const tall = fakePhoto("tall.jpg", 1000, 4000)
const wide = fakePhoto("wide.jpg", 4000, 1000)

describe("withPhoto", () => {
  it("fits a new photo to cover its slot", () => {
    const story = createEmptyCollectionStory()

    expect(withPhoto(story, 0, wide).fits[0]).toBe("height")
    expect(withPhoto(story, 0, tall).fits[0]).toBe("width")
  })
})

describe("withFrame", () => {
  it("re-fits and re-centers kept photos for the new slot shape", () => {
    const square = fakePhoto("square.jpg", 1000, 1000)
    let story = withPhoto(createEmptyCollectionStory(), 0, square)
    story = withPan(story, 0, { x: 0, y: 0 })

    // A square photo fills the height of the tall portrait slot…
    expect(story.fits[0]).toBe("height")

    // …and the width of the wide strip slot.
    const strip = withFrame(story, "strip")
    expect(strip.fits).toEqual(["width", "width", "width"])
    expect(strip.pans[0]).toEqual({ x: 0.5, y: 0.5 })
    expect(strip.photos).toEqual([square, null, null])
  })

  it("drops photos without a slot in the new frame", () => {
    let story = withFrame(createEmptyCollectionStory(), "stack")
    story = withPhoto(withPhoto(story, 0, tall), 1, wide)

    expect(withFrame(story, "portrait").photos).toEqual([tall])
  })

  it("returns the same story when the frame doesn't change", () => {
    const story = createEmptyCollectionStory()
    expect(withFrame(story, story.frameId)).toBe(story)
  })
})

describe("isStoryReady", () => {
  it("needs every slot filled or showing the background", () => {
    let story = withFrame(createEmptyCollectionStory(), "stack")
    expect(isStoryReady(story)).toBe(false)

    story = withPhoto(story, 0, tall)
    expect(isStoryReady(story)).toBe(false)

    story = withTransparentToggled(story, 1)
    expect(isStoryReady(story)).toBe(true)
  })

  it("clears the photo when a slot switches to the background", () => {
    const story = withTransparentToggled(
      withPhoto(createEmptyCollectionStory(), 0, tall),
      0
    )

    expect(story.photos[0]).toBeNull()
    expect(story.transparentSlots[0]).toBe(true)
  })
})

describe("story list", () => {
  function editorWith(count: number): EditorState {
    return {
      stories: Array.from({ length: count }, createEmptyCollectionStory),
      activeIndex: 0,
    }
  }

  it("inserts a story and makes it active", () => {
    const state = editorWith(2)
    const story = createEmptyCollectionStory()
    const next = insertStory(state, story, 1)

    expect(next.stories[1]).toBe(story)
    expect(next.activeIndex).toBe(1)
  })

  it("keeps the active story selected when an earlier one is removed", () => {
    const state = { ...editorWith(3), activeIndex: 2 }
    const next = removeStory(state, state.stories[0].id)

    expect(next.stories[next.activeIndex]).toBe(state.stories[2])
  })

  it("moves to the previous story when the last one is removed", () => {
    const state = { ...editorWith(3), activeIndex: 2 }
    const next = removeStory(state, state.stories[2].id)

    expect(next.activeIndex).toBe(1)
  })

  it("never removes the only story", () => {
    const state = editorWith(1)
    expect(removeStory(state, state.stories[0].id)).toBe(state)
  })
})

describe("filenames", () => {
  it("names the export after the first photo", () => {
    let story = withFrame(createEmptyCollectionStory(), "stack")
    expect(storyFilename(story)).toBe("stack-story.png")

    story = withPhoto(story, 1, tall)
    expect(storyFilename(story)).toBe("tall-story.png")
  })

  it("numbers duplicate names", () => {
    expect(uniqueFilenames(["a.png", "b.png", "a.png", "a.png"])).toEqual([
      "a.png",
      "b.png",
      "a-2.png",
      "a-3.png",
    ])
  })
})

describe("collectObjectUrls", () => {
  it("finds photo and background image URLs", () => {
    const story = withPhoto(createEmptyCollectionStory(), 0, tall)
    story.backgrounds.portrait = {
      ...story.backgrounds.portrait,
      image: wide,
    }

    expect([...collectObjectUrls([story])].sort()).toEqual([
      "blob:tall.jpg",
      "blob:wide.jpg",
    ])
  })
})
