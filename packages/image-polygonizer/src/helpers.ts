import { DEFAULT_CONFIG } from './constants';

import type { ImageConfig } from './types';

export function packAlphaMaskBits(
    pixels: Uint8Array,
    width: number,
    height: number,
    threshold: number,
    padding = 0,
): Uint8Array {
    const srcPixelCount = width * height;

    if (pixels.length < srcPixelCount * 4) {
        throw new Error(
            `pixels length (${pixels.length}) < width*height*4 (${srcPixelCount * 4})`
        );
    }

    // padded dims
    const pw = width + (padding << 1);
    const ph = height + (padding << 1);
    const dstPixelCount = pw * ph;

    // 1 bit per pixel in the padded image
    const out = new Uint8Array((dstPixelCount + 7) >>> 3);

    // padding=0 -> old fast path without extra checks
    if (padding === 0) {
        let outIndex = 0;
        let byte = 0;
        let bit = 0;

        for (let a = 3, p = 0; p < srcPixelCount; ++p, a += 4) {
            const filled = pixels[a] >= threshold ? 1 : 0;
            byte |= filled << bit;

            if (++bit === 8) {
                out[outIndex++] = byte;
                byte = 0;
                bit = 0;
            }
        }

        if (bit !== 0) out[outIndex] = byte;
        return out;
    }

    // ---- padded packing ----
    // We write only the "inner" rectangle (padding..padding+width-1, padding..padding+height-1),
    // and the border remains 0 (out is already zero-initialized).

    for (let y = 0; y < height; y++) {
        // row in the padded grid
        const dstRowBase = (y + padding) * pw + padding;
        // row in the src (RGBA)
        let a = (y * width * 4) + 3;

        for (let x = 0; x < width; x++, a += 4) {
            if (pixels[a] >= threshold) {
                const dstIndex = dstRowBase + x;      // 0..dstPixelCount-1
                out[dstIndex >>> 3] |= 1 << (dstIndex & 7); // LSB-first
            }
        }
    }

    return out;
}


export const fileToImageConfig = async (file: File): Promise<ImageConfig> => ({
    label: file.name.replace(/\.[^/.]+$/, ''),
    type: file.type.replace('image/', ''),
    src: await createImageBitmap(file),
    selected: false,
    outdated: false,
    hasPolygons: false,
    id: crypto.randomUUID(),
    config: { ...DEFAULT_CONFIG },
    polygonInfo: new Uint16Array(0),
});


export async function imageBitmapToRgbaPixels(bitmap: ImageBitmap): Promise<Uint8Array> {
    if (typeof VideoFrame !== "undefined" && VideoFrame && typeof VideoFrame.prototype.copyTo === "function") {
        let frame;

        try {
            frame = new VideoFrame(bitmap, { timestamp: 0 });

            const layout: VideoFrameCopyToOptions = { format: "RGBA" };

            const size = frame.allocationSize(layout);
            const pixels = new Uint8Array(size);

            await frame.copyTo(pixels, layout);

            return pixels;
        } catch (err) {
        } finally {
            try { frame?.close?.(); } catch { }
        }
    }

    // ---- 2) Fallback: OffscreenCanvas + 2D ----
    const width = bitmap.width;
    const height = bitmap.height;

    // In workers, OffscreenCanvas should exist. If not (rare), this will throw.
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0);

    const img = ctx.getImageData(0, 0, width, height);

    // img.data is Uint8ClampedArray. Make a Uint8Array (no copy) view of the same buffer:
    const pixels = new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength);

    // If you need your *own* buffer (to avoid the clamped buffer), then:
    // const pixels = new Uint8Array(img.data); // (copy)

    return pixels;
}

/* =========================================================
 * Shared geometry utilities
 * ========================================================= */

export function getX(
    contour: Uint16Array | Int32Array,
    pointIndex: number,
): number {
    return contour[pointIndex << 1];
}

export function getY(
    contour: Uint16Array | Int32Array,
    pointIndex: number,
): number {
    return contour[(pointIndex << 1) + 1];
}

export function normalizeClosedContour(contour: Uint16Array): Uint16Array {
    let pointCount = contour.length >> 1;

    if (pointCount === 0) {
        return contour.slice();
    }

    if (
        pointCount > 1 &&
        contour[0] === contour[(pointCount - 1) << 1] &&
        contour[1] === contour[((pointCount - 1) << 1) + 1]
    ) {
        --pointCount;
    }

    const out = new Uint16Array(pointCount << 1);

    for (let i = 0; i < out.length; ++i) {
        out[i] = contour[i];
    }

    return out;
}

export function polygonSignedArea(contour: Uint16Array): number {
    const count = contour.length >> 1;
    let sum = 0;

    for (let i = 0; i < count; ++i) {
        const j = (i + 1) % count;

        const xi = getX(contour, i);
        const yi = getY(contour, i);
        const xj = getX(contour, j);
        const yj = getY(contour, j);

        sum += xi * yj - xj * yi;
    }

    return sum * 0.5;
}

export function clampUint16(v: number): number {
    if (v < 0) return 0;
    if (v > 65535) return 65535;
    return v;
}

export function orientRaw(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
): number {
    return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

export function orient(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
): number {
    const v = orientRaw(ax, ay, bx, by, cx, cy);

    if (v > 0) return 1;
    if (v < 0) return -1;
    return 0;
}

export function pointBetween(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    px: number,
    py: number,
): boolean {
    return (
        px >= Math.min(ax, bx) &&
        px <= Math.max(ax, bx) &&
        py >= Math.min(ay, by) &&
        py <= Math.max(ay, by)
    );
}

export function onSegment(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    px: number,
    py: number,
): boolean {
    return (
        px >= Math.min(ax, bx) &&
        px <= Math.max(ax, bx) &&
        py >= Math.min(ay, by) &&
        py <= Math.max(ay, by) &&
        orient(ax, ay, bx, by, px, py) === 0
    );
}

export function pointOnSegment(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    px: number,
    py: number,
): boolean {
    return orientRaw(ax, ay, bx, by, px, py) === 0 &&
        pointBetween(ax, ay, bx, by, px, py);
}

export function segmentsIntersect(
    a0x: number,
    a0y: number,
    a1x: number,
    a1y: number,
    b0x: number,
    b0y: number,
    b1x: number,
    b1y: number,
): boolean {
    const o1 = orient(a0x, a0y, a1x, a1y, b0x, b0y);
    const o2 = orient(a0x, a0y, a1x, a1y, b1x, b1y);
    const o3 = orient(b0x, b0y, b1x, b1y, a0x, a0y);
    const o4 = orient(b0x, b0y, b1x, b1y, a1x, a1y);

    if (o1 !== o2 && o3 !== o4) {
        return true;
    }

    if (o1 === 0 && onSegment(a0x, a0y, a1x, a1y, b0x, b0y)) return true;
    if (o2 === 0 && onSegment(a0x, a0y, a1x, a1y, b1x, b1y)) return true;
    if (o3 === 0 && onSegment(b0x, b0y, b1x, b1y, a0x, a0y)) return true;
    if (o4 === 0 && onSegment(b0x, b0y, b1x, b1y, a1x, a1y)) return true;

    return false;
}

/* =========================================================
 * Linked contour state (shared between relaxation / point-limit)
 * ========================================================= */

export interface LinkedContourState {
    points: Uint16Array;
    prev: Int32Array;
    next: Int32Array;
    alive: Uint8Array;
    activeCount: number;
}

export function createLinkedState(points: Uint16Array): LinkedContourState {
    const pointCount = points.length >> 1;
    const prev = new Int32Array(pointCount);
    const next = new Int32Array(pointCount);
    const alive = new Uint8Array(pointCount);

    for (let i = 0; i < pointCount; ++i) {
        prev[i] = i === 0 ? pointCount - 1 : i - 1;
        next[i] = i === pointCount - 1 ? 0 : i + 1;
        alive[i] = 1;
    }

    return {
        points,
        prev,
        next,
        alive,
        activeCount: pointCount,
    };
}

export function removeVertex(state: LinkedContourState, index: number): void {
    const p = state.prev[index];
    const n = state.next[index];

    state.next[p] = n;
    state.prev[n] = p;
    state.alive[index] = 0;
    --state.activeCount;
}

export function findFirstAlive(alive: Uint8Array): number {
    for (let i = 0; i < alive.length; ++i) {
        if (alive[i] !== 0) {
            return i;
        }
    }

    return -1;
}

export function materializeState(state: LinkedContourState): Uint16Array {
    const out = new Uint16Array(state.activeCount << 1);

    const start = findFirstAlive(state.alive);

    if (start < 0) {
        return out;
    }

    let current = start;
    let w = 0;

    do {
        out[w] = getX(state.points, current);
        out[w + 1] = getY(state.points, current);
        w += 2;
        current = state.next[current];
    } while (current !== start);

    return out;
}

export function wouldCreateSelfIntersectionAfterRemoval(
    state: LinkedContourState,
    curr: number,
): boolean {
    if (state.activeCount <= 3) {
        return false;
    }

    const prev = state.prev[curr];
    const next = state.next[curr];

    const ax = getX(state.points, prev);
    const ay = getY(state.points, prev);
    const bx = getX(state.points, next);
    const by = getY(state.points, next);

    const start = findFirstAlive(state.alive);

    if (start < 0) {
        return false;
    }

    let e0 = start;

    do {
        const e1 = state.next[e0];

        if (
            e0 === prev ||
            e1 === prev ||
            e0 === curr ||
            e1 === curr ||
            e0 === next ||
            e1 === next
        ) {
            e0 = state.next[e0];
            continue;
        }

        const c0x = getX(state.points, e0);
        const c0y = getY(state.points, e0);
        const c1x = getX(state.points, e1);
        const c1y = getY(state.points, e1);

        if (segmentsIntersect(ax, ay, bx, by, c0x, c0y, c1x, c1y)) {
            return true;
        }

        e0 = state.next[e0];
    } while (e0 !== start);

    return false;
}

export function cross2(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
): number {
    return (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
}

export function polygonSignedAreaByState(state: LinkedContourState): number {
    const start = findFirstAlive(state.alive);

    if (start < 0) {
        return 0;
    }

    let sum = 0;
    let i = start;

    do {
        const j = state.next[i];

        sum +=
            getX(state.points, i) * getY(state.points, j) -
            getX(state.points, j) * getY(state.points, i);

        i = j;
    } while (i !== start);

    return sum * 0.5;
}

/* =========================================================
 * Triangle utilities (shared between triangulate / triangle-retopology)
 * ========================================================= */

export function buildUndirectedEdgeMap(
    triangles: number[],
): Map<string, { u: number; v: number; tris: number[] }> {
    const map = new Map<string, { u: number; v: number; tris: number[] }>();

    for (let i = 0; i < triangles.length; i += 3) {
        const a = triangles[i];
        const b = triangles[i + 1];
        const c = triangles[i + 2];

        addEdge(a, b, i);
        addEdge(b, c, i);
        addEdge(c, a, i);
    }

    return map;

    function addEdge(x: number, y: number, triIndex: number): void {
        const u = x < y ? x : y;
        const v = x < y ? y : x;
        const key = `${u}:${v}`;

        let entry = map.get(key);

        if (!entry) {
            entry = { u, v, tris: [] };
            map.set(key, entry);
        }

        entry.tris.push(triIndex);
    }
}

export function thirdVertexOfTriangle(
    a: number,
    b: number,
    c: number,
    u: number,
    v: number,
): number {
    if (a !== u && a !== v) return a;
    if (b !== u && b !== v) return b;
    if (c !== u && c !== v) return c;
    return -1;
}

export function triangleAngle(
    v1x: number,
    v1y: number,
    v2x: number,
    v2y: number,
): number {
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);

    if (len1 === 0 || len2 === 0) {
        return 0;
    }

    let cos = (v1x * v2x + v1y * v2y) / (len1 * len2);

    if (cos > 1) cos = 1;
    else if (cos < -1) cos = -1;

    return Math.acos(cos);
}

export function orientTriangleLikePolygon(
    contour: Uint16Array,
    a: number,
    b: number,
    c: number,
): [number, number, number] {
    const polySign = polygonSignedArea(contour) >= 0 ? 1 : -1;
    const triSign = orientRaw(
        getX(contour, a), getY(contour, a),
        getX(contour, b), getY(contour, b),
        getX(contour, c), getY(contour, c),
    );

    if ((polySign > 0 && triSign > 0) || (polySign < 0 && triSign < 0)) {
        return [a, b, c];
    }

    return [a, c, b];
}
