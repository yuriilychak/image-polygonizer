import { DEFAULT_CONFIG } from './constants';

import type { ButtonAction, ImageConfig, ImageMetadata } from './types';

export function getButtonActions(images: ImageConfig[]): ButtonAction[] {
    const result: ButtonAction[] = [];

    if (images.some(image => image.selected)) {
        result.push('generate');
    }

    result.push('import');

    const selectedImages = images.filter(image => image.selected);

    if (selectedImages.length && selectedImages.every(image => !image.outdated && image.hasPolygons)) {
        result.push('export');
    }

    if (images.length > 0) {
        result.push('save');
    }

    return result;
}

export const imageMetadataToConfig = (metadata: ImageMetadata): ImageConfig => ({
    ...metadata,
    selected: false,
    outdated: false,
    hasPolygons: false,
    id: crypto.randomUUID(),
    config: { ...DEFAULT_CONFIG },
});

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

export async function filesToImageMetadataList(files: FileList): Promise<ImageMetadata[]> {
    const imageFiles: File[] = [];

    for (let i = 0; i < files.length; ++i) {
        const f = files[i];
        if (f.type.startsWith("image/")) imageFiles.push(f);
    }

    if (imageFiles.length === 0) {
        return [];
    }

    const concurrency = getDefaultConcurrency(imageFiles.length);

    const result: ImageMetadata[] = [];
    let next = 0;

    async function worker(): Promise<void> {
        while (true) {
            const current = next++;

            if (current >= imageFiles.length) {
                return;
            }

            const file = imageFiles[current];

            try {
                const bitmap = await createImageBitmap(file);
                result.push({
                    label: file.name.replace(/\.[^/.]+$/, ""),
                    type: file.type.replace("image/", ""),
                    src: bitmap,
                });
            } catch (error) {
                console.error("Error processing file:", file.name, error);
            }
        }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    return result;
}
