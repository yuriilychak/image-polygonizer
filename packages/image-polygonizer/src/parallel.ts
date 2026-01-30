import { NOOP } from "./constants";

import type { ThreadInput, ThreadOutput, ThreadType } from "./types";

export default class Parallel {
    #threadsUsage: boolean[];

    #threadCount: number;

    #threads: Worker[];

    #input: ThreadInput[];

    #output: ThreadOutput[];

    #threadIndices: number[];

    #isTerminated: boolean = true;

    #iterationCount: number = 0;

    #startedThreads: number = 0;

    #totalThreads: number = 0;

    #onError: ((error: ErrorEvent) => void) = NOOP;

    #onSuccess: ((result: ThreadOutput<any>[]) => void) = NOOP;

    #onSpawn: ((count: number, progress: number) => void) = NOOP;

    constructor() {
        this.#threadCount = (navigator.hardwareConcurrency || 4) - 1;
        this.#threads = [];
        this.#threadsUsage = new Array(this.#threadCount);
        this.#threadIndices = new Array(this.#threadCount);
        this.#input = [];
        this.#output = [];

        this.#threadsUsage.fill(false);
        this.#threadIndices.fill(-1);
    }

    public start<T extends ThreadType>(
        input: ThreadInput<T>[],
        onSuccess: (result: ThreadOutput<T>[]) => void,
        onError: (error: ErrorEvent) => void,
        onSpawn: ((count: number, progress: number) => void) = NOOP
    ): boolean {
        if (input.length === 0) {
            this.#handleError(new ErrorEvent('Empty data'));
            return false;
        }

        this.#reset(false);
        this.#onError = onError;
        this.#onSuccess = onSuccess;
        this.#onSpawn = onSpawn;
        this.#input = input;
        this.#totalThreads = input.length;
        this.#output = new Array(this.#totalThreads);

        if (this.#isTerminated) {
            for (let i = 0; i < this.#threadCount; ++i) {
                this.#threads.push(new Worker('dist/image-polygonizer.calc.js', { type: 'module' }));
            }

            this.#isTerminated = false;
        }

        while (this.#startedThreads < this.#totalThreads && this.#threadsUsage.indexOf(false) !== -1) {
            this.#trigger();
        }

        return true;
    }

    public terminate(): void {
        for (let i = 0; i < this.#threads.length; ++i) {
            this.#threads[i].terminate();
        }

        this.#reset(true);
    }

    public get threadCount(): number {
        return this.#threadCount;
    }

    #reset(terminated: boolean): void {
        if (terminated) {
            this.#isTerminated = true;
            this.#threads.length = 0;
        }

        this.#threadsUsage.fill(false);
        this.#threadIndices.fill(-1);
        this.#input = [];
        this.#output = [];
        this.#iterationCount = 0;
        this.#startedThreads = 0;
        this.#totalThreads = 0;
        this.#onSuccess = NOOP;
        this.#onError = NOOP;
        this.#onSpawn = NOOP;
    }

    #trigger(): boolean {
        const index: number = this.#threadsUsage.indexOf(false);

        if (index === -1) {
            return false;
        }

        this.#threadsUsage[index] = true;

        const thread = this.#threads[index];
        const threadIndex: number = this.#startedThreads;

        ++this.#startedThreads;

        this.#threadIndices[index] = threadIndex;

        this.#onSpawn(this.#startedThreads, this.#startedThreads / this.#totalThreads);

        const { transfetrable = [], ...input } = this.#input[threadIndex];

        thread.onmessage = this.#onMessage;
        thread.onerror = this.#handleError;
        thread.postMessage(input, transfetrable);

        return true;
    }

    #onMessage = (message: MessageEvent<ThreadOutput<any>>) => {
        const index = this.#clean(message.currentTarget as Worker);
        const threadIndex = this.#threadIndices[index];

        this.#output[threadIndex] = message.data;

        if (this.#iterationCount === this.#totalThreads) {
            this.#onSuccess(this.#output);
            this.#reset(false);
            return;
        }

        if (this.#startedThreads < this.#totalThreads) {
            this.#trigger();
        }
    };

    #handleError = (error: ErrorEvent) => {
        this.#clean(error.currentTarget as Worker);
        this.#onError(error);
    };

    #clean(target: Worker): number {
        let i: number = 0;

        for (i = 0; i < this.#threadCount; ++i) {
            if (this.#threads[i] === target) {
                break;
            }
        }

        this.#threadsUsage[i] = false;
        ++this.#iterationCount;

        return i;
    }
}