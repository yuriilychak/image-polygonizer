/**
 * For each contour (polygon) in `contours`, builds a new bitmask that contains
 * only the pixels from `bitmask` that lie inside that contour.
 *
 * Bit layout of every mask: LSB-first, 1 bit/pixel, row-major —
 * identical to the format produced by `packAlphaMaskBits()`.
 *
 * Algorithm: scanline polygon fill with the even-odd (ray-crossing) rule.
 * Complexity: O(contours × height × vertsPerContour + filledPixels).
 *
 * @param contours  Array of polygons; each polygon is a flat Uint16Array
 *                  [x0, y0, x1, y1, …] (closing duplicate vertex is optional).
 * @param bitmask   Source bit-mask: Uint8Array, LSB-first, 1 bit/pixel, row-major.
 * @param width     Image width  in pixels.
 * @param height    Image height in pixels.
 * @returns         One Uint8Array per contour (same layout as `bitmask`),
 *                  where only source-set bits inside the polygon are preserved.
 */
export function masksInsideContours(
    contours: Uint16Array[],
    bitmask: Uint8Array,
    width: number,
    height: number,
): Uint8Array[] {
    const byteCount = (width * height + 7) >>> 3;

    // Reusable scratch buffer for scanline x-intersections (worst case = vertCount).
    let xsBuf = new Float64Array(64);

    const result: Uint8Array[] = [];

    for (const poly of contours) {
        const mask = new Uint8Array(byteCount);
        result.push(mask);

        const n = poly.length;
        if (n < 6) continue; // need at least 3 vertices

        // Detect closing duplicate (first vertex == last vertex).
        const closed = poly[0] === poly[n - 2] && poly[1] === poly[n - 1];
        const end = closed ? n - 2 : n; // logical end index
        const vertCount = end >>> 1;    // number of distinct vertices

        if (vertCount < 3) continue;

        // Ensure scratch buffer is large enough for all intersections.
        if (xsBuf.length < vertCount) {
            xsBuf = new Float64Array(vertCount);
        }

        // Compute bounding box to limit the scan area.
        let minX = poly[0], maxX = poly[0];
        let minY = poly[1], maxY = poly[1];

        for (let i = 2; i < end; i += 2) {
            const x = poly[i];
            const y = poly[i + 1];
            if (x < minX) minX = x;
            else if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            else if (y > maxY) maxY = y;
        }

        // Clamp to image bounds.
        const scanY0 = Math.max(0, minY);
        const scanY1 = Math.min(height - 1, maxY);
        const scanX0 = Math.max(0, minX);
        const scanX1 = Math.min(width - 1, maxX);

        // Scanline rasterization.
        // For each row y we cast a horizontal ray at y + 0.5 and collect
        // x-coordinates of all edge crossings, then fill between pairs.
        for (let y = scanY0; y <= scanY1; y++) {
            const yMid = y + 0.5;
            let xsLen = 0;

            for (let i = 0; i < vertCount; i++) {
                const ai = i << 1;
                const bi = ((i + 1) % vertCount) << 1;

                const ay = poly[ai + 1];
                const by = poly[bi + 1];

                // Edge must straddle yMid (half-open interval to avoid double-counting).
                if ((ay <= yMid && by > yMid) || (by <= yMid && ay > yMid)) {
                    const ax = poly[ai];
                    const bx = poly[bi];
                    const t = (yMid - ay) / (by - ay);
                    xsBuf[xsLen++] = ax + t * (bx - ax);
                }
            }

            if (xsLen < 2) continue;

            // Sort intersections (insertion sort is fast for small counts).
            for (let i = 1; i < xsLen; i++) {
                const key = xsBuf[i];
                let j = i - 1;
                while (j >= 0 && xsBuf[j] > key) {
                    xsBuf[j + 1] = xsBuf[j];
                    j--;
                }
                xsBuf[j + 1] = key;
            }

            // Fill pixel spans between consecutive intersection pairs.
            const rowBase = y * width;
            for (let p = 0; p + 1 < xsLen; p += 2) {
                const xStart = Math.max(scanX0, Math.ceil(xsBuf[p]));
                const xEnd = Math.min(scanX1, Math.floor(xsBuf[p + 1]));

                for (let x = xStart; x <= xEnd; x++) {
                    const idx = rowBase + x;
                    // Copy bit only if it is set in the source bitmask.
                    if ((bitmask[idx >>> 3] >>> (idx & 7)) & 1) {
                        mask[idx >>> 3] |= 1 << (idx & 7);
                    }
                }
            }
        }
    }

    return result;
}
