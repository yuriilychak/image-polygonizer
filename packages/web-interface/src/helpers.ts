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