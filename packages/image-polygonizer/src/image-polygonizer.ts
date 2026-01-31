import Parallel from './parallel';

import type { ImageConfig, ImagePolygonizerInstance, ImageActionPayload, ThreadInput, PolygonInfo } from './types';
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

        return threadInput.length !== 0
            ? new Promise((resolve, reject) =>
                this.#parallel.start(
                    threadInput,
                    (threadOutput: ImageConfig[]) => resolve(threadOutput),
                    reject
                )
            )
            : Promise.resolve([]);
    }

    async polygonize(images: ImageConfig[]): Promise<ImageActionPayload<PolygonInfo>[]> {
        const threadInput: ThreadInput<'polygonize'>[] = images.map((image) => ({
            type: 'polygonize',
            data: image,
        }));
        return threadInput.length !== 0
            ? new Promise((resolve, reject) =>
                this.#parallel.start(
                    threadInput,
                    (threadOutput: ImageActionPayload<PolygonInfo>[]) => resolve(threadOutput),
                    reject
                )
            )
            : Promise.resolve([]);
    }
}
