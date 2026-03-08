// ============================================================
// Bit-mask dilation (outline expansion)
//
// Bit layout: LSB-first, 1 bit per pixel, row-major —
// identical to the format produced by packAlphaMaskBits().
// ============================================================

/**
 * Returns a new bit-mask equal to `mask` dilated by a circular kernel of
 * radius `outlineSize` pixels.
 *
 * Every pixel that lies within Euclidean distance `outlineSize` of any set
 * pixel in the source mask will be set in the result.  The original set
 * pixels are always preserved.
 *
 * @param mask        Source bit-mask (Uint8Array, LSB-first packed, 1 bit/px).
 * @param width       Image width  in pixels.
 * @param height      Image height in pixels.
 * @param outlineSize Dilation radius in pixels (non-negative integer).
 * @returns           New Uint8Array bit-mask with the circular outline added.
 */
export function extendBitMask(
    mask: Uint8Array,
    width: number,
    height: number,
    outlineSize: number,
): Uint8Array {
    const pixelCount = width * height;
    const byteCount = (pixelCount + 7) >>> 3;
    const out = new Uint8Array(byteCount);

    // Nothing to dilate — return an exact copy.
    if (outlineSize <= 0) {
        out.set(mask.subarray(0, byteCount));
        return out;
    }

    const r = outlineSize | 0; // guarantee integer
    const r2 = r * r;

    // Precompute, for each dy in [0..r], the maximum dx that still fits
    // inside the circle: dx_max[dy] = floor(sqrt(r² − dy²)).
    const dxMax = new Int32Array(r + 1);
    for (let dy = 0; dy <= r; dy++) {
        dxMax[dy] = Math.floor(Math.sqrt(r2 - dy * dy));
    }

    // Iterate over every set pixel in the source mask and paint a filled
    // circle of radius r around it into `out`.
    for (let y = 0; y < height; y++) {
        const rowBase = y * width;

        for (let x = 0; x < width; x++) {
            const idx = rowBase + x;

            // Skip unset pixels.
            if (!((mask[idx >>> 3] >>> (idx & 7)) & 1)) continue;

            const ny0 = Math.max(0, y - r);
            const ny1 = Math.min(height - 1, y + r);

            for (let ny = ny0; ny <= ny1; ny++) {
                const dy = Math.abs(ny - y);
                const dx = dxMax[dy];
                const nx0 = Math.max(0, x - dx);
                const nx1 = Math.min(width - 1, x + dx);
                const nRowBase = ny * width;

                // Set every bit in the horizontal span [nx0, nx1].
                for (let nx = nx0; nx <= nx1; nx++) {
                    const nidx = nRowBase + nx;
                    out[nidx >>> 3] |= 1 << (nidx & 7);
                }
            }
        }
    }

    return out;
}
