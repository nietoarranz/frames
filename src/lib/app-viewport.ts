function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    Boolean(
      "standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone
    )
  )
}

function screenHeight() {
  const portrait = window.matchMedia("(orientation: portrait)").matches
  return portrait ? window.screen.height : window.screen.width
}

function measureHeight() {
  const viewportHeight = Math.max(
    window.innerHeight,
    window.visualViewport?.height ?? 0,
    document.documentElement.clientHeight
  )

  if (isStandalone()) {
    // iOS home-screen mode reports a short innerHeight/vh, but the
    // webview still paints the rest of the screen (the black gap).
    return Math.max(viewportHeight, screenHeight())
  }

  return viewportHeight
}

export function installAppViewport() {
  const root = document.documentElement

  if (isStandalone()) {
    root.classList.add("standalone")
  }

  function sync() {
    const height = `${Math.round(measureHeight())}px`
    root.style.setProperty("--app-height", height)
    root.style.height = height
    document.body.style.height = height
  }

  sync()
  requestAnimationFrame(sync)
  window.setTimeout(sync, 50)
  window.setTimeout(sync, 300)
  window.visualViewport?.addEventListener("resize", sync)
  window.addEventListener("resize", sync)
  window.addEventListener("orientationchange", () => {
    requestAnimationFrame(sync)
    window.setTimeout(sync, 300)
  })
}
