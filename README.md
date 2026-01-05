# Image Polygonizer

A browser-based polygonization tool for PNG/WebP assets: detect non-transparent regions, trace contours (e.g., marching squares), and simplify them into compact polygons (e.g., RDP) with configurable vertex budgets, and offsets. Built with React and WebAssembly for fast, interactive processing and export-ready results.

## Monorepo Structure

This is a Turborepo monorepo containing the following packages:

- **web-interface** - React + TypeScript web application built with Vite
- **image-polygonizer** - TypeScript library built with Rollup
- **image-polygonizer-algo** - Rust algorithms compiled to WebAssembly

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Rust and wasm-pack (for building the WASM package)

## Installation

```bash
npm install
```

## Building

Build all packages:

```bash
npm run build
```

## Development

Start the development server:

```bash
npm run dev
```

## Running the Web Interface

After building, you can serve the web interface locally:

```bash
npm run serve
```

This will start a local server at http://localhost:3000

## Linting

Run ESLint on all packages:

```bash
npm run lint
```

## Formatting

Format all code with Prettier:

```bash
npm run format
```

Check formatting:

```bash
npm run format:check
```

## Documentation

Generate TypeDoc documentation for TypeScript packages:

```bash
npm run docs
```

## Package Details

### web-interface

React-based user interface for the polygonizer tool.

- Build: `npm run build --workspace=web-interface`
- Dev: `npm run dev --workspace=web-interface`
- Serve: `npm run serve --workspace=web-interface`

### image-polygonizer

Core TypeScript library for image polygonization.

- Build: `npm run build --workspace=image-polygonizer`
- Dev: `npm run dev --workspace=image-polygonizer`

### image-polygonizer-algo

Rust algorithms compiled to WebAssembly.

- Build: `npm run build --workspace=image-polygonizer-algo`
- Dev: `npm run dev --workspace=image-polygonizer-algo`

## Clean

Remove all build artifacts and dependencies:

```bash
npm run clean
```
