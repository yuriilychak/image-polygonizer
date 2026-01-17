import { ButtonAction, ImageConfig } from "./types";


export function getButtonActions(images: ImageConfig[]): ButtonAction[] {
    const result: ButtonAction[] = [];

    if (images.some(image => image.selected)) {
        result.push('generate');
    }

    result.push('import');

    if (images.length > 0) {
        result.push('export', 'save');
    }

    return result;
}