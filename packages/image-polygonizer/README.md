# image-polygonizer

TypeScript library that wraps the `image-polygonizer-algo` WebAssembly module and exposes a high-level API for image polygonization. Handles worker-pool threading, image I/O, project serialization, and ZIP export.

## Installation

This package is part of the [image-polygonizer](https://github.com/yuriilychak/image-polygonizer) monorepo. It is not currently published to npm.

## Quick start

```typescript
import ImagePolygonizer from 'image-polygonizer';

const polygonizer = new ImagePolygonizer();
await polygonizer.init();

const images = await polygonizer.importImages(fileInputElement.files);
const results = await polygonizer.polygonize(images);
```

## API

### `ImagePolygonizer`

The main class. All methods are async and run heavy work in Web Workers.

```typescript
class ImagePolygonizer {
    /** Initialise the WASM module across all worker threads. Must be called before any other method. */
    init(): Promise<void>;

    /** Load images from a FileList (e.g. from an <input type="file">). */
    importImages(files: FileList): Promise<ImageConfig[]>;

    /** Run polygonization on the supplied images. Returns serialised polygon data per image. */
    polygonize(images: ImageConfig[]): Promise<ImageActionPayload<Uint16Array>[]>;

    /** Serialise the full project (images + polygon data) to a compressed binary buffer. */
    serializeImages(images: ImageConfig[]): Promise<Uint8Array>;

    /** Restore a project from a buffer previously produced by serializeImages(). */
    deserializeImages(data: Uint8Array): Promise<ImageConfig[]>;

    /** Export selected images as cropped PNGs + JSON files, returned as ExportedImage objects. */
    exportImages(images: ImageConfig[], exportConfig: ExportConfig): Promise<ExportedImage[]>;
}
```

### `PolygonData`

Singleton that handles binary serialisation and deserialisation of polygon data produced by the WASM module.

```typescript
class PolygonData {
    static getInstance(): PolygonData;

    serialize(
        alphaMask: Uint8Array,
        contours: Uint16Array[],
        polygons: Uint16Array[],
        triangles: Uint16Array[],
        config: ImageSetting,
        offset: number,
        outline: Uint16Array
    ): Uint16Array;

    deserializeConfig(buf: Uint16Array): ImageSetting;
    deserializeAlphaMask(buf: Uint16Array): Uint8Array;
    deserializeContours(buf: Uint16Array): Uint16Array[];
    deserializePolygons(buf: Uint16Array): Uint16Array[];
    deserializeTriangles(buf: Uint16Array): Uint16Array[];

    hasAlphaMask(buf: Uint16Array): boolean;
    hasContours(buf: Uint16Array): boolean;
    hasPolygons(buf: Uint16Array): boolean;
    hasTriangles(buf: Uint16Array): boolean;
}
```

### `ImageConfigSerialization`

Utilities for packing and unpacking `ImageConfig` objects to/from binary buffers (used for project save/load).

```typescript
namespace ImageConfigSerialization {
    serialize(config: ImageConfig): Promise<Uint8Array>;
    deserialize(data: Uint8Array): Promise<ImageConfig>;
    serializeMany(entries: Uint8Array[]): Uint8Array;
    deserializeMany(data: Uint8Array): Uint8Array[];
}
```

## Key types

```typescript
type ImageConfigKey = 'maxPointCount' | 'alphaThreshold' | 'minimalDistance';
type ImageSetting = Record<ImageConfigKey, number>;

interface ImageConfig {
    id: string;
    label: string;
    type: string;
    src: ImageBitmap;
    selected: boolean;
    hasPolygons: boolean;
    outdated: boolean;
    config: ImageSetting;
    polygonInfo: Uint16Array | null;
}

type CropOption = 'none' | 'alpha' | 'polygon' | '';

interface SharedExportConfig {
    exportPolygons: boolean;
    exportTriangles: boolean;
}

interface ExportConfig {
    shared: SharedExportConfig;
    fileConfig: Record<string, CropOption>;
}

interface ExportedImage {
    name: string;
    id: string;
    img: ImageBitmap;
    config: object;
}
```

## Threading model

The library spawns `navigator.hardwareConcurrency − 1` Web Workers on initialisation (managed by the internal `Parallel` class). Each worker loads the WASM module independently and handles one image at a time. Tasks are distributed across idle workers and results are collected in their original order.

The worker bundle is built as a separate IIFE (`image-polygonizer.calc.js`) and loaded alongside the main ESM bundle (`image-polygonizer.js`).

## Build output

| File | Format | Purpose |
|---|---|---|
| `dist/image-polygonizer.js` | ESM | Main library entry point |
| `dist/image-polygonizer.js.map` | Source map | Debug support |
| `dist/image-polygonizer.calc.js` | IIFE | Web Worker bundle |
| `dist/image-polygonizer.calc.js.map` | Source map | Debug support |

## Scripts

```bash
npm run build   # Rollup bundle (ESM + IIFE)
npm run dev     # Watch mode
npm run lint    # ESLint
npm run docs    # Generate TypeDoc API documentation
```
