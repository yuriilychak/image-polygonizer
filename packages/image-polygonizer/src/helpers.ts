import { DEFAULT_CONFIG } from './constants';

import type { ImageConfig } from './types';

export function packAlphaMaskBits(
    pixels: Uint8Array,
    width: number,
    height: number,
    threshold: number,
): Uint8Array {
    const pixelCount = width * height;

    if (pixels.length < pixelCount * 4) {
        throw new Error(`pixels length (${pixels.length}) < width*height*4 (${pixelCount * 4})`);
    }

    // 1 біт на піксель
    const out = new Uint8Array((pixelCount + 7) >>> 3);

    // clamp threshold to 0..255 just in case
    threshold = threshold < 0 ? 0 : threshold > 255 ? 255 : threshold;

    let outIndex = 0;
    let byte = 0;
    let bit = 0;

    // альфа починається з індексу 3 і йде кроком 4
    for (let a = 3, p = 0; p < pixelCount; ++p, a += 4) {
        // 1 якщо alpha >= threshold, інакше 0
        const filled = pixels[a] >= threshold ? 1 : 0;

        byte |= filled << bit;

        if (++bit === 8) {
            out[outIndex++] = byte;
            byte = 0;
            bit = 0;
        }
    }

    // якщо лишились біти, докидаємо останній байт
    if (bit !== 0) {
        out[outIndex] = byte;
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

    // Якщо тобі потрібен *власний* буфер (щоб без clamped-буфера), тоді:
    // const pixels = new Uint8Array(img.data); // (копія)

    return pixels;
}

