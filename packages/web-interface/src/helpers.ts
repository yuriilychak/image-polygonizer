import type { ImageConfig } from 'image-polygonizer';
import type { ButtonAction } from './types';

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