import { zipSync, strToU8 } from 'fflate';
import { PROJECT_EXTENSION } from './constants';

import type { ImageConfig } from 'image-polygonizer';
import type { ExportedImage } from 'image-polygonizer';
import type { ButtonAction } from './types';

export function getButtonActions(images: ImageConfig[]): ButtonAction[] {
    const result: ButtonAction[] = ['import'];

    const selectedImages = images.filter(image => image.selected);

    if (selectedImages.length) {
        result.unshift('generate');

        if (selectedImages.every(image => !image.outdated && image.hasPolygons)) {
            result.push('export');
        }
    }

    if (images.length > 0) {
        result.push('save');
    }

    return result;
}

export async function saveProject(projectName: string, data: Uint8Array, a: HTMLAnchorElement): Promise<void> {
    const compressed = await new Response(
        new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('gzip')),
    ).blob();
    const url = URL.createObjectURL(compressed);
    a.href = url;
    a.download = `${projectName}${PROJECT_EXTENSION}`;
    a.click();
    URL.revokeObjectURL(url);
}

export async function loadProject(file: File): Promise<Uint8Array> {
    const decompressed = await new Response(
        file.stream().pipeThrough(new DecompressionStream('gzip')),
    ).arrayBuffer();

    return new Uint8Array(decompressed);
}

async function imageBitmapToPng(img: ImageBitmap): Promise<Uint8Array> {
    const canvas = new OffscreenCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return new Uint8Array(await blob.arrayBuffer());
}

export async function exportProject(
    results: ExportedImage[],
    projectName: string,
    anchor: HTMLAnchorElement,
): Promise<void> {
    const entries = await Promise.all(
        results.map(async ({ name, img, config }) => ({
            name,
            png: await imageBitmapToPng(img),
            json: strToU8(JSON.stringify(config, null, 2)),
        }))
    );

    const files: Record<string, Uint8Array> = {};
    for (const { name, png, json } of entries) {
        files[`${name}.png`] = png;
        files[`${name}.json`] = json;
    }

    const zipped = zipSync(files);
    const url = URL.createObjectURL(new Blob([zipped], { type: 'application/zip' }));
    anchor.href = url;
    anchor.download = `${projectName}.zip`;
    anchor.click();
    URL.revokeObjectURL(url);
}