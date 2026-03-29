import Parallel from '../parallel';

const MockWorker = (globalThis as any).MockWorker;

describe('Parallel', () => {
    let parallel: Parallel;

    beforeEach(() => {
        parallel = new Parallel();
    });

    describe('threadCount', () => {
        it('is hardwareConcurrency - 1', () => {
            expect(parallel.threadCount).toBe(3);
        });
    });

    describe('start()', () => {
        it('returns false for empty input', () => {
            // #onError is NOOP until a non-empty start() sets it, so the provided
            // callback is not reachable when input is empty on a fresh instance.
            const onError = vi.fn();
            const result = parallel.start([], vi.fn(), onError);
            expect(result).toBe(false);
        });

        it('returns true for non-empty input', () => {
            const input = [{ type: 'init' as const, data: new ArrayBuffer(0) }];
            const result = parallel.start(input, vi.fn(), vi.fn());
            expect(result).toBe(true);
        });

        it('creates threadCount workers on first start', () => {
            const input = [{ type: 'init' as const, data: new ArrayBuffer(0) }];
            parallel.start(input, vi.fn(), vi.fn());
            expect(MockWorker.instances.length).toBe(3);
        });

        it('posts message to worker with correct data', () => {
            const data = new ArrayBuffer(8);
            const input = [{ type: 'init' as const, data, transfetrable: [data] }];
            parallel.start(input, vi.fn(), vi.fn());
            const worker = MockWorker.instances[0];
            expect(worker.postMessage).toHaveBeenCalledWith(
                { type: 'init', data },
                [data],
            );
        });

        it('calls onSpawn with count and progress for single task', () => {
            const onSpawn = vi.fn();
            const input = [{ type: 'init' as const, data: new ArrayBuffer(0) }];
            parallel.start(input, vi.fn(), vi.fn(), onSpawn);
            expect(onSpawn).toHaveBeenCalledTimes(1);
            expect(onSpawn).toHaveBeenCalledWith(1, 1);
        });

        it('calls onSpawn once per task with correct progress', () => {
            const onSpawn = vi.fn();
            const inputs = [
                { type: 'addImages' as const, data: new File([], 'a.png', { type: 'image/png' }) },
                { type: 'addImages' as const, data: new File([], 'b.png', { type: 'image/png' }) },
            ];
            parallel.start(inputs, vi.fn(), vi.fn(), onSpawn);
            expect(onSpawn).toHaveBeenCalledTimes(2);
            expect(onSpawn).toHaveBeenNthCalledWith(1, 1, 0.5);
            expect(onSpawn).toHaveBeenNthCalledWith(2, 2, 1);
        });

        it('calls onSuccess when all tasks complete', () => {
            const onSuccess = vi.fn();
            const input = [{ type: 'init' as const, data: new ArrayBuffer(0) }];
            parallel.start(input, onSuccess, vi.fn());

            MockWorker.instances[0].simulateMessage('result1');
            expect(onSuccess).toHaveBeenCalledWith(['result1']);
        });

        it('preserves task order in onSuccess result', () => {
            const onSuccess = vi.fn();
            const inputs = [
                { type: 'addImages' as const, data: new File([], 'a.png', { type: 'image/png' }) },
                { type: 'addImages' as const, data: new File([], 'b.png', { type: 'image/png' }) },
            ];
            parallel.start(inputs, onSuccess, vi.fn());

            MockWorker.instances[0].simulateMessage('img1');
            MockWorker.instances[1].simulateMessage('img2');

            expect(onSuccess).toHaveBeenCalledWith(['img1', 'img2']);
        });

        it('queues extra tasks when input exceeds threadCount', () => {
            const onSuccess = vi.fn();
            const inputs = Array.from({ length: 5 }, (_, i) => ({
                type: 'init' as const,
                data: new ArrayBuffer(i),
            }));
            parallel.start(inputs, onSuccess, vi.fn());

            // Only threadCount (3) workers active initially
            const activeWorkers = MockWorker.instances.filter(w => w.postMessage.mock.calls.length > 0);
            expect(activeWorkers.length).toBe(3);

            // Complete one → next task spawns
            MockWorker.instances[0].simulateMessage('r0');
            expect(MockWorker.instances[0].postMessage).toHaveBeenCalledTimes(2);

            MockWorker.instances[1].simulateMessage('r1');
            MockWorker.instances[0].simulateMessage('r3');
            MockWorker.instances[2].simulateMessage('r2');
            MockWorker.instances[1].simulateMessage('r4');

            expect(onSuccess).toHaveBeenCalledWith(['r0', 'r1', 'r2', 'r3', 'r4']);
        });

        it('calls onError when a worker emits an error', () => {
            const onError = vi.fn();
            const input = [{ type: 'init' as const, data: new ArrayBuffer(0) }];
            parallel.start(input, vi.fn(), onError);

            MockWorker.instances[0].simulateError('Worker crashed');
            expect(onError).toHaveBeenCalled();
        });

        it('reuses workers on second start after completion', () => {
            const input1 = [{ type: 'init' as const, data: new ArrayBuffer(0) }];
            parallel.start(input1, vi.fn(), vi.fn());
            MockWorker.instances[0].simulateMessage('done');

            const workerCountAfterFirst = MockWorker.instances.length;

            const input2 = [{ type: 'init' as const, data: new ArrayBuffer(0) }];
            parallel.start(input2, vi.fn(), vi.fn());

            expect(MockWorker.instances.length).toBe(workerCountAfterFirst);
        });
    });

    describe('terminate()', () => {
        it('calls terminate on all workers', () => {
            const input = [{ type: 'init' as const, data: new ArrayBuffer(0) }];
            parallel.start(input, vi.fn(), vi.fn());
            const workers = [...MockWorker.instances];
            parallel.terminate();
            workers.forEach(w => expect(w.terminate).toHaveBeenCalled());
        });

        it('creates new workers on next start after terminate', () => {
            const input1 = [{ type: 'init' as const, data: new ArrayBuffer(0) }];
            parallel.start(input1, vi.fn(), vi.fn());
            parallel.terminate();

            const countAfterTerminate = MockWorker.instances.length;

            const input2 = [{ type: 'init' as const, data: new ArrayBuffer(0) }];
            parallel.start(input2, vi.fn(), vi.fn());

            expect(MockWorker.instances.length).toBe(countAfterTerminate + 3);
        });
    });
});
