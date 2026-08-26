import { Component, StrictMode, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import "./index.css"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { installAppViewport } from "@/lib/app-viewport"
import { CollectionPage } from "@/pages/collection"

installAppViewport()

class BootErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            boxSizing: "border-box",
            minHeight: "100%",
            padding: 24,
            color: "#fafafa",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <p style={{ fontWeight: 600 }}>The app failed to open.</p>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>
            {this.state.error.message}
          </pre>
        </div>
      )
    }

    return this.props.children
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BootErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<CollectionPage />} />
            <Route path="/collection" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </BootErrorBoundary>
  </StrictMode>
)
