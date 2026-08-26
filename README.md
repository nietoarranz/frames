# Frames

React + Vite + TypeScript app for placing photos inside 9:16 Instagram Story frames.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start the dev server:

```bash
npm run dev
```

The collection editor is the home page. Frames can be added in `src/lib/collection-frames.ts`.

## Scripts

| Command | Description |
| ----------------- | ------------------------------------------------ |
| `npm run dev` | Start Vite dev server |
| `npm run build` | Typecheck and production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run deploy` | Build and publish `dist` to the `gh-pages` branch |

## GitHub Pages (custom domain)

The site deploys to the `gh-pages` branch and is meant to be served at [https://frames.nietoarranz.com](https://frames.nietoarranz.com). Vite’s default `base` is `/` (not a project subpath), so asset URLs work on the custom domain root. `public/CNAME` is copied into `dist` on build.

### Manual setup (once)

1. **DNS** (on `nietoarranz.com`): add a CNAME record `frames` → `nietoarranz.github.io`.
2. **GitHub → Settings → Pages**: source = `gh-pages` / root; custom domain = `frames.nietoarranz.com`; enable HTTPS after DNS verifies.

### Publish updates

```bash
npm run deploy
```

This runs `build`, writes `dist/.nojekyll`, and publishes `dist` (including CNAME and dotfiles) to `gh-pages`.
