import { vi } from 'vitest';

// Must use `function`, not an arrow, when the mock is called with `new`.
vi.mock('../wasm-wrapper', () => ({
    default: vi.fn().mockImplementation(function () {
        return {
            initBuffer: vi.fn().mockResolvedValue(undefined),
            polygonize: vi.fn().mockReturnValue(new Uint16Array([1, 2, 3])),
        };
    }),
}));

vi.mock('../helpers', () => ({
    fileToImageConfig: vi.fn().mockResolvedValue({
        id: 'file-id',
        label: 'sprite',
        type: 'png',
        src: { width: 10, height: 10 },
        selected: false,
        outdated: false,
        hasPolygons: false,
        config: { maxPointCount: 32, alphaThreshold: 1, minimalDistance: 8 },
        polygonInfo: new Uint16Array(0),
    }),
    imageBitmapToRgbaPixels: vi.fn().mockResolvedValue(new Uint8Array([0, 0, 0, 255])),
    exportImage: vi.fn().mockResolvedValue({ img: { width: 10, height: 10 }, cropX: 0, cropY: 0 }),
    buildExportConfig: vi.fn().mockReturnValue({ polygons: [], triangles: [] }),
}));

vi.mock('../image-config-serialization', () => ({
    ImageConfigSerialization: {
        serialize: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
        deserialize: vi.fn().mockResolvedValue({
            id: 'imported-id',
            label: 'imported',
            type: 'png',
            src: { width: 5, height: 5 },
            selected: false,
            outdated: false,
            hasPolygons: true,
            config: { maxPointCount: 32, alphaThreshold: 1, minimalDistance: 8 },
            polygonInfo: new Uint16Array([1, 2]),
        }),
    },
}));

// Importing the worker sets self.onmessage as a module-level side effect.
import '../image-poligonizer.worker';
import { fileToImageConfig, imageBitmapToRgbaPixels, exportImage, buildExportConfig } from '../helpers';
import { ImageConfigSerialization } from '../image-config-serialization';
import WasmWrapper from '../wasm-wrapper';

async function sendMessage(data: any): Promise<void> {
    await (self as any).onmessage({ data });
}

// Capture the singleton wasm instance created at module-load time before any
// vi.clearAllMocks() can clear the mock.results array.
let wasmInstance: any;
let postMessageSpy: ReturnType<typeof vi.fn>;

beforeAll(async () => {
    wasmInstance = vi.mocked(WasmWrapper).mock.results[0].value;
    // Resolve the module-level wasmReady promise so polygonize tests don't hang.
    await sendMessage({ type: 'init', data: new ArrayBuffer(4) });
});

beforeEach(() => {
    vi.clearAllMocks();
    // Restore implementations cleared by vi.clearAllMocks() (it only clears
    // call history, but being explicit avoids surprises).
    wasmInstance.initBuffer.mockResolvedValue(undefined);
    wasmInstance.polygonize.mockReturnValue(new Uint16Array([1, 2, 3]));
    postMessageSpy = vi.mocked((global as any).postMessage);
});

// ── init ─────────────────────────────────────────────────────────────────────

describe("'init' message", () => {
    it('calls wasm.initBuffer with the provided ArrayBuffer', async () => {
        const buffer = new ArrayBuffer(8);
        await sendMessage({ type: 'init', data: buffer });
        expect(wasmInstance.initBuffer).toHaveBeenCalledWith(buffer);
    });

    it('postMessages undefined with an empty transferable list', async () => {
        await sendMessage({ type: 'init', data: new ArrayBuffer(4) });
        expect(postMessageSpy).toHaveBeenCalledWith(undefined, []);
    });
});

// ── addImages ────────────────────────────────────────────────────────────────

describe("'addImages' message", () => {
    it('calls fileToImageConfig with the provided File', async () => {
        const file = new File([''], 'sprite.png', { type: 'image/png' });
        await sendMessage({ type: 'addImages', data: file });
        expect(fileToImageConfig).toHaveBeenCalledWith(file);
    });

    it('postMessages the ImageConfig returned by fileToImageConfig', async () => {
        await sendMessage({ type: 'addImages', data: new File([''], 'img.png', { type: 'image/png' }) });
        const [message] = postMessageSpy.mock.calls[0];
        expect(message).toMatchObject({ id: 'file-id', label: 'sprite' });
    });

    it('includes src in the transferable list', async () => {
        await sendMessage({ type: 'addImages', data: new File([''], 'img.png', { type: 'image/png' }) });
        const [, transferable] = postMessageSpy.mock.calls[0];
        expect(transferable).toHaveLength(1);
    });
});

// ── projectImport ─────────────────────────────────────────────────────────────

describe("'projectImport' message", () => {
    it('calls ImageConfigSerialization.deserialize with the provided Uint8Array', async () => {
        const data = new Uint8Array([10, 20, 30]);
        await sendMessage({ type: 'projectImport', data });
        expect(ImageConfigSerialization.deserialize).toHaveBeenCalledWith(data);
    });

    it('postMessages the deserialized ImageConfig', async () => {
        await sendMessage({ type: 'projectImport', data: new Uint8Array([1]) });
        const [message] = postMessageSpy.mock.calls[0];
        expect(message).toMatchObject({ id: 'imported-id', label: 'imported' });
    });

    it('includes src and polygonInfo.buffer in the transferable list', async () => {
        await sendMessage({ type: 'projectImport', data: new Uint8Array([1]) });
        const [, transferable] = postMessageSpy.mock.calls[0];
        expect(transferable).toHaveLength(2);
    });
});

// ── projectExport ─────────────────────────────────────────────────────────────

describe("'projectExport' message", () => {
    const imageConfig = {
        id: 'img-export',
        label: 'exported',
        type: 'png',
        src: { width: 10, height: 10 } as unknown as ImageBitmap,
        selected: false,
        outdated: false,
        hasPolygons: true,
        config: { maxPointCount: 32, alphaThreshold: 1, minimalDistance: 8 },
        polygonInfo: new Uint16Array([1, 2, 3]),
    };
    const exportConfig = { cropOption: 'none' as const, exportPolygons: true, exportTriangles: false };

    it('calls exportImage with src, polygonInfo, and cropOption', async () => {
        await sendMessage({ type: 'projectExport', data: { imageConfig, exportConfig } });
        expect(exportImage).toHaveBeenCalledWith(imageConfig.src, imageConfig.polygonInfo, exportConfig.cropOption);
    });

    it('calls buildExportConfig with polygon info, crop offsets, and export config', async () => {
        await sendMessage({ type: 'projectExport', data: { imageConfig, exportConfig } });
        expect(buildExportConfig).toHaveBeenCalledWith(
            imageConfig.polygonInfo,
            0, // cropX from mock
            0, // cropY from mock
            exportConfig,
        );
    });

    it('postMessages object with name, id, img, and config', async () => {
        await sendMessage({ type: 'projectExport', data: { imageConfig, exportConfig } });
        const [message] = postMessageSpy.mock.calls[0];
        expect(message).toMatchObject({ name: 'exported', id: 'img-export' });
        expect(message.img).toBeDefined();
        expect(message.config).toBeDefined();
    });

    it('includes img in the transferable list', async () => {
        await sendMessage({ type: 'projectExport', data: { imageConfig, exportConfig } });
        const [, transferable] = postMessageSpy.mock.calls[0];
        expect(transferable).toHaveLength(1);
    });
});

// ── projectSave ───────────────────────────────────────────────────────────────

describe("'projectSave' message", () => {
    const imageConfig = {
        id: 'img-save',
        label: 'saved',
        type: 'png',
        src: { width: 10, height: 10 } as unknown as ImageBitmap,
        selected: false,
        outdated: false,
        hasPolygons: false,
        config: { maxPointCount: 32, alphaThreshold: 1, minimalDistance: 8 },
        polygonInfo: new Uint16Array(0),
    };

    it('calls ImageConfigSerialization.serialize with the ImageConfig', async () => {
        await sendMessage({ type: 'projectSave', data: imageConfig });
        expect(ImageConfigSerialization.serialize).toHaveBeenCalledWith(imageConfig);
    });

    it('postMessages the serialized Uint8Array', async () => {
        await sendMessage({ type: 'projectSave', data: imageConfig });
        const [message] = postMessageSpy.mock.calls[0];
        expect(message).toBeInstanceOf(Uint8Array);
    });

    it('includes the buffer in the transferable list', async () => {
        await sendMessage({ type: 'projectSave', data: imageConfig });
        const [, transferable] = postMessageSpy.mock.calls[0];
        expect(transferable).toHaveLength(1);
        expect(transferable[0]).toBeInstanceOf(ArrayBuffer);
    });
});

// ── polygonize ────────────────────────────────────────────────────────────────

describe("'polygonize' message", () => {
    // wasmReady was resolved in beforeAll via 'init', so this doesn't hang.
    const mockImageConfig = {
        id: 'img-poly',
        src: { width: 10, height: 10 } as unknown as ImageBitmap,
        config: { alphaThreshold: 1, minimalDistance: 8, maxPointCount: 32 },
    };

    it('calls imageBitmapToRgbaPixels with src', async () => {
        await sendMessage({ type: 'polygonize', data: mockImageConfig });
        expect(imageBitmapToRgbaPixels).toHaveBeenCalledWith(mockImageConfig.src);
    });

    it('calls wasm.polygonize with pixel data and image dimensions', async () => {
        await sendMessage({ type: 'polygonize', data: mockImageConfig });
        expect(wasmInstance.polygonize).toHaveBeenCalledWith(
            expect.any(Uint8Array),
            mockImageConfig.src.width,
            mockImageConfig.src.height,
            mockImageConfig.config.alphaThreshold,
            mockImageConfig.config.minimalDistance,
            mockImageConfig.config.maxPointCount,
        );
    });

    it('postMessages { id, data } with the polygon Uint16Array', async () => {
        await sendMessage({ type: 'polygonize', data: mockImageConfig });
        const [message] = postMessageSpy.mock.calls[0];
        expect(message).toMatchObject({ id: 'img-poly' });
        expect(message.data).toBeInstanceOf(Uint16Array);
    });

    it('includes polygonData.buffer in the transferable list', async () => {
        await sendMessage({ type: 'polygonize', data: mockImageConfig });
        const [, transferable] = postMessageSpy.mock.calls[0];
        expect(transferable).toHaveLength(1);
        expect(transferable[0]).toBeInstanceOf(ArrayBuffer);
    });
});

// ── unknown type ──────────────────────────────────────────────────────────────

describe('unknown message type', () => {
    it('postMessages an error response object', async () => {
        await sendMessage({ type: 'totally-unknown' });
        const [message] = postMessageSpy.mock.calls[0];
        expect(message).toMatchObject({ type: 'error' });
    });
});
