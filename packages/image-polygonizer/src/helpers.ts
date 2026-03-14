import { DEFAULT_CONFIG } from './constants';

import type { ImageConfig } from './types';

export const fileToImageConfig = async (file: File): Promise<ImageConfig> => ({
    label: file.name.replace(/\.[^/.]+$/, ''),
    type: file.type.replace('image/', ''),
    src: await createImageBitmap(file, { premultiplyAlpha: 'none' }),
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

    // ---- Fallback: OffscreenCanvas + 2D ----
    const width = bitmap.width;
    const height = bitmap.height;

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0);

    const img = ctx.getImageData(0, 0, width, height);

    return new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength);
}

