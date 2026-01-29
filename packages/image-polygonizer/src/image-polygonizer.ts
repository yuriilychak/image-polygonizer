import { DEFAULT_CONFIG } from './constants';
import { getDefaultConcurrency } from './helpers';

import type { ImageConfig, ImagePolygonizerInstance } from './types';
export default class ImagePolygonizer implements ImagePolygonizerInstance {
    constructor() {
        // Initialization code here
    }

    async importImages(files: FileList): Promise<ImageConfig[]> {
        const imageFiles: File[] = [];

        for (let i = 0; i < files.length; ++i) {
            const f = files[i];
            if (f.type.startsWith('image/')) imageFiles.push(f);
        }

        if (imageFiles.length === 0) {
            return [];
        }

        const concurrency = getDefaultConcurrency(imageFiles.length);

        const result: ImageConfig[] = [];
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
                        label: file.name.replace(/\.[^/.]+$/, ''),
                        type: file.type.replace('image/', ''),
                        src: bitmap,
                        selected: false,
                        outdated: false,
                        hasPolygons: false,
                        id: crypto.randomUUID(),
                        config: { ...DEFAULT_CONFIG },
                    });
                } catch (error) {
                    console.error('Error processing file:', file.name, error);
                }
            }
        }

        await Promise.all(Array.from({ length: concurrency }, () => worker()));

        return result;
    }

    async polygonize(polygonizeImages: ImageConfig[]): Promise<void> {
        console.log('IMages', polygonizeImages);

        return Promise.resolve();
    }
}
