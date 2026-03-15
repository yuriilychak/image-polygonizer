import Parallel from './parallel';
import { ImageConfigSerialization } from './image-config-serialization';

import type { ImageConfig, ImagePolygonizerInstance, ImageActionPayload, ThreadInput } from './types';
export default class ImagePolygonizer implements ImagePolygonizerInstance {
    #parallel: Parallel;

    #isInit = false;

    constructor() {
        this.#parallel = new Parallel();
    }

    async init(): Promise<void> {
        if (!this.#isInit) {
            this.#isInit = true;
        } else {
            return;
        }

        const buffer = await fetch('image-polygonizer.wasm').then(r => r.arrayBuffer());
        const count = this.#parallel.threadCount;
        const inputs: ThreadInput<'init'>[] = Array.from({ length: count }, () => {
            const clone = buffer.slice(0);
            return { type: 'init', data: clone, transfetrable: [clone] };
        });
        return new Promise((resolve, reject) =>
            this.#parallel.start(inputs, () => resolve(), reject)
        );
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

    async polygonize(images: ImageConfig[]): Promise<ImageActionPayload<Uint16Array>[]> {
        const threadInput: ThreadInput<'polygonize'>[] = images.map((image) => ({
            type: 'polygonize',
            data: image,
        }));
        return threadInput.length !== 0
            ? new Promise((resolve, reject) =>
                this.#parallel.start(
                    threadInput,
                    (threadOutput: ImageActionPayload<Uint16Array>[]) => resolve(threadOutput),
                    reject
                )
            )
            : Promise.resolve([]);
    }

    async serializeImages(images: ImageConfig[]): Promise<Uint8Array> {
        const threadInput: ThreadInput<'projectSave'>[] = images.map((image) => ({
            type: 'projectSave',
            data: image,
        }));
        return threadInput.length !== 0
            ? new Promise((resolve, reject) =>
                this.#parallel.start(
                    threadInput,
                    (threadOutput: Uint8Array[]) => resolve(ImageConfigSerialization.serializeMany(threadOutput)),
                    reject
                )
            )
            : Promise.resolve(ImageConfigSerialization.serializeMany([]));
    }

    async deserializeImages(data: Uint8Array): Promise<ImageConfig[]> {
        const slices = ImageConfigSerialization.deserializeMany(data);
        const threadInput: ThreadInput<'projectImport'>[] = slices.map((slice) => ({
            type: 'projectImport',
            data: slice,
        }));
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
}
