export function imageBitmapToAlphaMask(imageBitmap: ImageBitmap, threshold: number): Uint8Array {
    const { width, height } = imageBitmap;
    const pixelCount = width * height;
    const byteCount = (pixelCount + 7) >> 3;
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;

    ctx.drawImage(imageBitmap, 0, 0);

    const { data } = ctx.getImageData(0, 0, width, height); // RGBA
    const result = new Uint8Array(byteCount);

    // LSB-first: піксель i -> біт (i&7) у байті (i>>3)
    for (let i = 0, j = 3; i < pixelCount; i++, j += 4) {
        if (data[j] >= threshold) {
            result[i >> 3] |= 1 << (i & 7);
        }
    }

    return result;
}

export function getDefaultConcurrency(
    max: number,
    min = 1,
    defaultValue = 8,
    reserveForMainThread = 1,
): number {
    let c = (navigator.hardwareConcurrency ?? defaultValue) - reserveForMainThread;

    // clamp via branches (fast, avoids ToInt32 coercion)
    if (c < min) c = min;
    else if (c > max) c = max;

    return c >>> 0;
}