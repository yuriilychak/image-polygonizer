import type { ImageConfig } from 'image-polygonizer';
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
    a.download = `${projectName}.ipp`;
    a.click();
    URL.revokeObjectURL(url);
}

export async function loadProject(file: File): Promise<Uint8Array> {
    const decompressed = await new Response(
        file.stream().pipeThrough(new DecompressionStream('gzip')),
    ).arrayBuffer();

    return new Uint8Array(decompressed);
}