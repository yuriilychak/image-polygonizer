import Parallel from './parallel';

import type { ImageConfig, ImagePolygonizerInstance, ThreadInput } from './types';
export default class ImagePolygonizer implements ImagePolygonizerInstance {
    #parallel: Parallel;

    constructor() {
        this.#parallel = new Parallel();
    }

    async importImages(files: FileList): Promise<ImageConfig[]> {
        const threadInput: ThreadInput<'addImages'>[] = [];
        let data: File;

        for (let i = 0; i < files.length; ++i) {
            data = files[i];

            if (data.type.startsWith('image/')) {
                threadInput.push({ type: 'addImages', data });
            }
        }

        return threadInput.length !== 0 ? new Promise((resolve, reject) => {
            this.#parallel.start(threadInput, (threadOutput: ImageConfig[]) => {
                resolve(threadOutput);
            }, (err) => {
                console.error('Error importing images:', err);
                reject(err);
            });
        }) : Promise.resolve([]);
    }

    async polygonize(polygonizeImages: ImageConfig[]): Promise<void> {
        console.log('IMages', polygonizeImages);

        return Promise.resolve();
    }
}
