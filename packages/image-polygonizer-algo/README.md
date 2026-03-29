# image-polygonizer-algo

Core polygonization algorithms compiled from Rust to WebAssembly. This package implements the full pipeline that converts an RGBA pixel buffer into polygon and triangle mesh data.

## Overview

The WASM module exposes a single `polygonize()` function. All heavy computation — alpha extraction, contour tracing, polygon simplification, and triangulation — happens inside the WASM module with near-native performance.

## Algorithm pipeline

### 1 — Alpha bitmask (`bitmask.rs`)

Reads the raw RGBA pixel buffer and applies an `alpha_threshold` to classify every pixel as opaque or transparent, producing a compact 1-bit-per-pixel bitmask. A fixed `32 px` padding border is added around the image so contours that touch image edges remain closed. Uses SIMD128 intrinsics on `wasm32` targets with a scalar fallback for other targets.

### 2 — Contour tracing (`marching_squares.rs`)

Detects connected opaque regions via 4-connectivity flood fill and walks the boundary of each region using [marching squares](https://en.wikipedia.org/wiki/Marching_squares), recording the sequence of edge coordinates as a raw contour.

### 3 — Polygon simplification (`polygon.rs`)

Each raw contour is reduced to a polygon through a five-step pipeline:

1. [Ramer–Douglas–Peucker (RDP)](https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm) simplification using `minimal_distance` as epsilon, with self-intersection removal
2. Iterative relax-and-simplify loop (removes small pits and obtuse humps)
3. Excess vertex removal until `max_point_count` is satisfied
4. Coverage extension — expands the simplified contour to fully cover the original
5. Edge refinement via sliding edges (`sliding_edges.rs`)

### 4 — Triangulation (`triangulation.rs`)

Each polygon is tessellated into triangles using [ear clipping](https://en.wikipedia.org/wiki/Two_ears_theorem). Two passes of edge-flip optimisation (Lawson flip + sliver-minimising flip) improve triangle quality by reducing degenerate triangles.

### 5 — Serialisation (`serialization.rs`)

All results — alpha mask, contours, polygons, and triangles — are packed into a compact `Uint16Array` and returned to the JavaScript caller with zero-copy transfer via `Transferable`.

## Public API

```rust
#[wasm_bindgen]
pub fn polygonize(
    pixels: &[u8],        // RGBA pixel buffer (width × height × 4 bytes)
    width: u16,           // Image width in pixels
    height: u16,          // Image height in pixels
    alpha_threshold: u8,  // Alpha cutoff 1–255
    minimal_distance: u8, // RDP epsilon in pixels 1–255
    max_point_count: u8,  // Max polygon vertices 4–255
) -> Vec<u16>            // Serialised polygon data (Uint16Array)
```

## Building

Requires the Rust toolchain and [`wasm-pack`](https://rustwasm.github.io/wasm-pack/).

```bash
# Release build (optimised, placed in ../../dist/)
bash build.sh release

# Development build (debug info)
bash build.sh dev
```

Output: `../../dist/image-polygonizer.wasm`

The release build uses `opt-level = "z"` (size optimisation) and LTO to minimise the WASM binary footprint.

## Dependencies

| Crate | Purpose |
|---|---|
| `wasm-bindgen` | JavaScript ↔ WASM bindings |
| `console_error_panic_hook` | Human-readable panic messages in the browser console |
