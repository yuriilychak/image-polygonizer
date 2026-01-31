import { DEFAULT_CONFIG, DEFAULT_POLYGON_INFO } from './constants';

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

    // 1 біт на піксель у padded зображенні
    const out = new Uint8Array((dstPixelCount + 7) >>> 3);

    // padding=0 -> старий швидкий шлях без зайвих умов
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
    // Ми пишемо тільки "внутрішній" прямокутник (padding..padding+width-1, padding..padding+height-1),
    // а бордер лишається 0 (out вже ініціалізований нулями).

    for (let y = 0; y < height; y++) {
        // рядок у padded сітці
        const dstRowBase = (y + padding) * pw + padding;
        // рядок у src (RGBA)
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
    polygonInfo: { ...DEFAULT_POLYGON_INFO},
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

