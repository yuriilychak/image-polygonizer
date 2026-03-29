# web-interface

React 18 web application that provides the user interface for [Image Polygonizer](https://github.com/yuriilychak/image-polygonizer).

🔗 **Live: [https://yuriilychak.github.io/image-polygonizer/](https://yuriilychak.github.io/image-polygonizer/)**

## Tech stack

- **React 18** with hooks (`useReducer`, `useRef`, `useEffect`)
- **Vite 5** for bundling and dev server
- **TypeScript** (strict mode)
- **i18next** — 7 supported languages: English, German, Spanish, French, Polish, Russian, Ukrainian
- **fflate** — compression for project save/load files

## UI structure

```
App
├── ActionMenu          # Left sidebar
│   ├── ProjectName     # Editable project name
│   ├── ImageList       # Loaded images with thumbnails, selection, labels
│   ├── ImageDetails    # Per-image parameter sliders
│   └── ActionsSection  # Import / Polygonize / Export / Save / Load buttons
├── WorkingArea         # Central canvas
│   └── Canvas          # Renders image + overlay toggles (alpha / contour / polygon / triangles)
└── ExportModal         # Export overlay (z-index: 2)
    ├── ModalHeader     # Title + close
    ├── ImageCard[]     # Per-image crop option selector + preview
    └── ModalFooter     # Export / Cancel buttons + shared export flags
```

## State management

State is managed with a single `useReducer` in the root component. All async side effects (WASM initialisation, polygonization, file I/O) are dispatched from the `usePolygonizer()` hook.

**Key state fields:**

| Field | Type | Description |
|---|---|---|
| `images` | `ImageConfig[]` | All loaded images with polygon data |
| `currentImage` | `ImageConfig \| null` | Currently selected image |
| `exportConfig` | `ExportConfig` | Shared + per-file export settings |
| `isExportModalOpen` | `boolean` | Controls export modal visibility |
| `disabled` | `boolean` | Locks UI during async operations |
| `currentLanguage` | `string` | Active i18n locale |
| `projectName` | `string` | Name used for save file |

## Canvas overlays

The working area canvas can render four optional overlays on top of the source image:

| Toggle | Colour | Shows |
|---|---|---|
| Alpha | Semi-transparent | Transparent pixel regions |
| Contour | Blue | Raw marching-squares contours |
| Polygon | Filled colours | Simplified polygon shapes |
| Triangles | Wireframe | Ear-clipping triangulation |

## Scripts

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Type-check + Vite production build
npm run preview  # Preview the production build locally
npm run serve    # Alias for dev
npm run lint     # ESLint with TypeScript rules
npm run docs     # Generate TypeDoc documentation
npm run clean    # Remove dist/ and docs/
```

## Environment variables

| Variable | Value | Effect |
|---|---|---|
| `GITHUB_PAGES` | `'true'` | Sets Vite `base` to `/image-polygonizer/` for GitHub Pages deployment |

## Build output

All build artefacts are written to the monorepo root `dist/` folder (shared with the `image-polygonizer` and `image-polygonizer-algo` packages):

```
dist/
├── index.html
├── assets/
│   ├── index-*.js      # Bundled React app
│   └── index-*.css     # Styles
├── image-polygonizer.js        # Library (external, not bundled)
├── image-polygonizer.calc.js   # Worker bundle
└── image-polygonizer.wasm      # WASM module
```
