export type ImageRect = {
  x: number
  y: number
  width: number
  height: number
}

export async function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.src = src
  await image.decode()
  return image
}

function canShareFiles(files: File[]) {
  return (
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files })
  )
}

/** Saves files through ordinary downloads, one after another. */
export async function downloadFiles(files: File[]) {
  for (const [index, file] of files.entries()) {
    if (index > 0) {
      // Browsers drop rapid consecutive downloads.
      await new Promise((resolve) => window.setTimeout(resolve, 250))
    }

    const url = URL.createObjectURL(file)
    const link = document.createElement("a")
    link.href = url
    link.download = file.name
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}

/**
 * Opens the share sheet when the browser can share these files, and falls
 * back to downloads when it can't or sharing fails. Cancelling the share
 * sheet is not a failure.
 */
export async function shareFiles(files: File[]) {
  if (files.length === 0) {
    return
  }

  if (canShareFiles(files)) {
    try {
      await navigator.share({ files })
      return
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return
      }
    }
  }

  await downloadFiles(files)
}
