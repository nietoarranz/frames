/// <reference types="vitest/config" />
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

/** Files from `public/` the app needs offline. */
const OFFLINE_PUBLIC_FILES = [
  "/",
  "/site.webmanifest",
  "/favicon.ico",
  "/favicon.svg",
  "/favicon-32x32.png",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
]

/**
 * Emits `sw.js` with this build's files to precache. The version is a hash of
 * the (content-hashed) file names, so each deploy ships a new worker.
 */
function serviceWorker(): Plugin {
  return {
    name: "frames-service-worker",
    apply: "build",
    generateBundle(_, bundle) {
      const precache = [
        ...OFFLINE_PUBLIC_FILES,
        ...Object.keys(bundle)
          .filter((file) => file !== "index.html" && !file.endsWith(".map"))
          .map((file) => `/${file}`),
      ]
      const version = createHash("sha256")
        .update(precache.join("\n"))
        .digest("hex")
        .slice(0, 12)
      const source = readFileSync(
        path.resolve(import.meta.dirname, "sw/service-worker.js"),
        "utf8"
      )
        .replace("__VERSION__", JSON.stringify(version))
        .replace("__PRECACHE__", JSON.stringify(precache))

      this.emitFile({ type: "asset", fileName: "sw.js", source })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorker()],
  server: {
    host: true,
    allowedHosts: true,
    headers: {
      "Permissions-Policy": "web-share=(self)",
      "Cache-Control": "no-store",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
})
