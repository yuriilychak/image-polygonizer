import { vi } from 'vitest';

// mockParallelInstance is captured by reference in the factory closure.
// Each test's beforeEach assigns a fresh object; new ImagePolygonizer()
// calls new Parallel() which returns it.
let mockParallelInstance: { start: any; terminate: any; threadCount: number };

vi.mock('../parallel', () => ({
    // Must use `function`, not an arrow, when the mock is called with `new`.
    default: vi.fn().mockImplementation(function () {
        return mockParallelInstance;
    }),
}));

vi.mock('../image-config-serialization', () => ({
    ImageConfigSerialization: {
        serializeMany: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
        deserializeMany: vi.fn().mockReturnValue([]),
    },
}));

import ImagePolygonizer from '../image-polygonizer';
import { ImageConfigSerialization } from '../image-config-serialization';

function makeImageConfig(id = 'img-1') {
    return {
        id,
        label: 'test',
        type: 'png',
        src: { width: 10, height: 10 } as unknown as ImageBitmap,
        selected: false,
        outdated: false,
        hasPolygons: false,
        config: { maxPointCount: 32, alphaThreshold: 1, minimalDistance: 8 },
        polygonInfo: new Uint16Array(0),
    };
}

beforeEach(() => {
    // Fresh vi.fn() instances per test — no need for vi.clearAllMocks().
    mockParallelInstance = {
        threadCount: 3,
        start: vi.fn(),
        terminate: vi.fn(),
    };
    vi.mocked(ImageConfigSerialization.serializeMany).mockReturnValue(new Uint8Array([1, 2, 3]));
    vi.mocked(ImageConfigSerialization.deserializeMany).mockReturnValue([]);
    vi.mocked(fetch).mockReset();
});

// ── init() ───────────────────────────────────────────────────────────────────

describe('init()', () => {
    it('fetches wasm and starts worker initialization', async () => {
        const fakeBuffer = new ArrayBuffer(4);
        vi.mocked(fetch).mockResolvedValue({ arrayBuffer: () => Promise.resolve(fakeBuffer) } as any);
        mockParallelInstance.start.mockImplementation((_input: any, onSuccess: any) => {
            onSuccess([]);
            return true;
        });

        const polygonizer = new ImagePolygonizer();
        await polygonizer.init();

        expect(fetch).toHaveBeenCalledWith('image-polygonizer.wasm');
        expect(mockParallelInstance.start).toHaveBeenCalledTimes(1);
        const [inputs] = mockParallelInstance.start.mock.calls[0];
        expect(inputs).toHaveLength(3); // threadCount
        expect(inputs[0].type).toBe('init');
        expect(inputs[0].data).toBeInstanceOf(ArrayBuffer);
    });

    it('each init task has a distinct ArrayBuffer clone', async () => {
        const fakeBuffer = new ArrayBuffer(4);
        vi.mocked(fetch).mockResolvedValue({ arrayBuffer: () => Promise.resolve(fakeBuffer) } as any);
        mockParallelInstance.start.mockImplementation((_input: any, onSuccess: any) => {
            onSuccess([]);
            return true;
        });

        const polygonizer = new ImagePolygonizer();
        await polygonizer.init();

        const [inputs] = mockParallelInstance.start.mock.calls[0];
        const buffers = inputs.map((i: any) => i.data);
        expect(buffers[0]).not.toBe(buffers[1]);
        expect(buffers[1]).not.toBe(buffers[2]);
    });

    it('does not fetch wasm or start workers on second call', async () => {
        const fakeBuffer = new ArrayBuffer(4);
        vi.mocked(fetch).mockResolvedValue({ arrayBuffer: () => Promise.resolve(fakeBuffer) } as any);
        mockParallelInstance.start.mockImplementation((_input: any, onSuccess: any) => {
            onSuccess([]);
            return true;
        });

        const polygonizer = new ImagePolygonizer();
        await polygonizer.init();
        await polygonizer.init();

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(mockParallelInstance.start).toHaveBeenCalledTimes(1);
    });

    it('rejects when parallel.start calls onError', async () => {
        const fakeBuffer = new ArrayBuffer(4);
        vi.mocked(fetch).mockResolvedValue({ arrayBuffer: () => Promise.resolve(fakeBuffer) } as any);
        const errorEvent = new ErrorEvent('Worker error');
        mockParallelInstance.start.mockImplementation((_input: any, _onSuccess: any, onError: any) => {
            onError(errorEvent);
            return true;
        });

        const polygonizer = new ImagePolygonizer();
        await expect(polygonizer.init()).rejects.toBe(errorEvent);
    });
});

// ── importImages() ───────────────────────────────────────────────────────────

describe('importImages()', () => {
    it('returns empty array when FileList is empty', async () => {
        const files = { length: 0 } as unknown as FileList;
        const polygonizer = new ImagePolygonizer();
        const result = await polygonizer.importImages(files);
        expect(result).toEqual([]);
        expect(mockParallelInstance.start).not.toHaveBeenCalled();
    });

    it('returns empty array when no image files in list', async () => {
        const files = {
            length: 1,
            0: new File([''], 'doc.txt', { type: 'text/plain' }),
        } as unknown as FileList;
        const polygonizer = new ImagePolygonizer();
        const result = await polygonizer.importImages(files);
        expect(result).toEqual([]);
        expect(mockParallelInstance.start).not.toHaveBeenCalled();
    });

    it('filters out non-image files and sends only images to workers', async () => {
        const imgFile = new File([''], 'sprite.png', { type: 'image/png' });
        const files = {
            length: 2,
            0: new File([''], 'doc.txt', { type: 'text/plain' }),
            1: imgFile,
        } as unknown as FileList;

        mockParallelInstance.start.mockImplementation((_input: any, onSuccess: any) => {
            onSuccess([makeImageConfig()]);
            return true;
        });

        const polygonizer = new ImagePolygonizer();
        await polygonizer.importImages(files);

        const [inputs] = mockParallelInstance.start.mock.calls[0];
        expect(inputs).toHaveLength(1);
        expect(inputs[0].type).toBe('addImages');
        expect(inputs[0].data).toBe(imgFile);
    });

    it('creates one addImages task per image file', async () => {
        const files = {
            length: 3,
            0: new File([''], 'a.png', { type: 'image/png' }),
            1: new File([''], 'b.jpg', { type: 'image/jpeg' }),
            2: new File([''], 'c.gif', { type: 'image/gif' }),
        } as unknown as FileList;

        const expectedOutput = [makeImageConfig('1'), makeImageConfig('2'), makeImageConfig('3')];
        mockParallelInstance.start.mockImplementation((_input: any, onSuccess: any) => {
            onSuccess(expectedOutput);
            return true;
        });

        const polygonizer = new ImagePolygonizer();
        const result = await polygonizer.importImages(files);

        const [inputs] = mockParallelInstance.start.mock.calls[0];
        expect(inputs).toHaveLength(3);
        inputs.forEach((inp: any) => expect(inp.type).toBe('addImages'));
        expect(result).toEqual(expectedOutput);
    });
});

// ── polygonize() ─────────────────────────────────────────────────────────────

describe('polygonize()', () => {
    it('returns empty array for empty input', async () => {
        const polygonizer = new ImagePolygonizer();
        const result = await polygonizer.polygonize([]);
        expect(result).toEqual([]);
        expect(mockParallelInstance.start).not.toHaveBeenCalled();
    });

    it('creates one polygonize task per image', async () => {
        const images = [makeImageConfig('img-1'), makeImageConfig('img-2')];
        const expectedOutput = [
            { id: 'img-1', data: new Uint16Array([1, 2]) },
            { id: 'img-2', data: new Uint16Array([3, 4]) },
        ];

        mockParallelInstance.start.mockImplementation((_input: any, onSuccess: any) => {
            onSuccess(expectedOutput);
            return true;
        });

        const polygonizer = new ImagePolygonizer();
        const result = await polygonizer.polygonize(images);

        const [inputs] = mockParallelInstance.start.mock.calls[0];
        expect(inputs).toHaveLength(2);
        expect(inputs[0].type).toBe('polygonize');
        expect(inputs[0].data).toBe(images[0]);
        expect(inputs[1].data).toBe(images[1]);
        expect(result).toEqual(expectedOutput);
    });
});

// ── serializeImages() ────────────────────────────────────────────────────────

describe('serializeImages()', () => {
    it('calls serializeMany with empty array when no images', async () => {
        const polygonizer = new ImagePolygonizer();
        await polygonizer.serializeImages([]);
        expect(ImageConfigSerialization.serializeMany).toHaveBeenCalledWith([]);
        expect(mockParallelInstance.start).not.toHaveBeenCalled();
    });

    it('creates one projectSave task per image', async () => {
        const images = [makeImageConfig()];
        mockParallelInstance.start.mockImplementation((_input: any, onSuccess: any) => {
            onSuccess([new Uint8Array([10, 20])]);
            return true;
        });

        const polygonizer = new ImagePolygonizer();
        await polygonizer.serializeImages(images);

        const [inputs] = mockParallelInstance.start.mock.calls[0];
        expect(inputs).toHaveLength(1);
        expect(inputs[0].type).toBe('projectSave');
        expect(inputs[0].data).toBe(images[0]);
    });

    it('calls serializeMany with the thread output and returns the result', async () => {
        const images = [makeImageConfig()];
        const chunks = [new Uint8Array([10, 20])];
        const packed = new Uint8Array([99, 88]);

        mockParallelInstance.start.mockImplementation((_input: any, onSuccess: any) => {
            onSuccess(chunks);
            return true;
        });
        vi.mocked(ImageConfigSerialization.serializeMany).mockReturnValue(packed);

        const polygonizer = new ImagePolygonizer();
        const result = await polygonizer.serializeImages(images);

        expect(ImageConfigSerialization.serializeMany).toHaveBeenCalledWith(chunks);
        expect(result).toBe(packed);
    });
});

// ── deserializeImages() ──────────────────────────────────────────────────────

describe('deserializeImages()', () => {
    it('returns empty array when deserializeMany returns no slices', async () => {
        vi.mocked(ImageConfigSerialization.deserializeMany).mockReturnValue([]);
        const polygonizer = new ImagePolygonizer();
        const result = await polygonizer.deserializeImages(new Uint8Array(0));
        expect(result).toEqual([]);
        expect(mockParallelInstance.start).not.toHaveBeenCalled();
    });

    it('creates one projectImport task per slice', async () => {
        const slice1 = new Uint8Array([1, 2]);
        const slice2 = new Uint8Array([3, 4]);
        vi.mocked(ImageConfigSerialization.deserializeMany).mockReturnValue([slice1, slice2]);

        const expectedConfigs = [makeImageConfig('a'), makeImageConfig('b')];
        mockParallelInstance.start.mockImplementation((_input: any, onSuccess: any) => {
            onSuccess(expectedConfigs);
            return true;
        });

        const polygonizer = new ImagePolygonizer();
        const result = await polygonizer.deserializeImages(new Uint8Array([5, 6, 7]));

        const [inputs] = mockParallelInstance.start.mock.calls[0];
        expect(inputs).toHaveLength(2);
        expect(inputs[0].type).toBe('projectImport');
        expect(inputs[0].data).toBe(slice1);
        expect(inputs[1].data).toBe(slice2);
        expect(result).toEqual(expectedConfigs);
    });
});

// ── exportImages() ───────────────────────────────────────────────────────────

describe('exportImages()', () => {
    const sharedConfig = { exportPolygons: true, exportTriangles: false };

    it('returns empty array for no images', async () => {
        const exportConfig = { shared: sharedConfig, fileConfig: {} };
        const polygonizer = new ImagePolygonizer();
        const result = await polygonizer.exportImages([], exportConfig);
        expect(result).toEqual([]);
        expect(mockParallelInstance.start).not.toHaveBeenCalled();
    });

    it('creates one projectExport task per image', async () => {
        const images = [makeImageConfig('img-1'), makeImageConfig('img-2')];
        const exportConfig = { shared: sharedConfig, fileConfig: {} };

        mockParallelInstance.start.mockImplementation((_input: any, onSuccess: any) => {
            onSuccess([]);
            return true;
        });

        const polygonizer = new ImagePolygonizer();
        await polygonizer.exportImages(images, exportConfig);

        const [inputs] = mockParallelInstance.start.mock.calls[0];
        expect(inputs).toHaveLength(2);
        inputs.forEach((inp: any) => expect(inp.type).toBe('projectExport'));
    });

    it('sets cropOption from fileConfig for each image', async () => {
        const image = makeImageConfig('img-1');
        const exportConfig = {
            shared: sharedConfig,
            fileConfig: { 'img-1': 'alpha' as const },
        };

        mockParallelInstance.start.mockImplementation((_input: any, onSuccess: any) => {
            onSuccess([]);
            return true;
        });

        const polygonizer = new ImagePolygonizer();
        await polygonizer.exportImages([image], exportConfig);

        const [inputs] = mockParallelInstance.start.mock.calls[0];
        expect(inputs[0].data.imageConfig).toBe(image);
        expect(inputs[0].data.exportConfig.cropOption).toBe('alpha');
        expect(inputs[0].data.exportConfig.exportPolygons).toBe(true);
        expect(inputs[0].data.exportConfig.exportTriangles).toBe(false);
    });

    it('defaults cropOption to none when image id is not in fileConfig', async () => {
        const image = makeImageConfig('img-2');
        const exportConfig = { shared: sharedConfig, fileConfig: {} };

        mockParallelInstance.start.mockImplementation((_input: any, onSuccess: any) => {
            onSuccess([]);
            return true;
        });

        const polygonizer = new ImagePolygonizer();
        await polygonizer.exportImages([image], exportConfig);

        const [inputs] = mockParallelInstance.start.mock.calls[0];
        expect(inputs[0].data.exportConfig.cropOption).toBe('none');
    });
});
