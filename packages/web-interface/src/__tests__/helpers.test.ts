import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getButtonActions, saveProject, loadProject, exportProject } from '../helpers';

vi.mock('fflate', () => ({
    zipSync: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
    strToU8: vi.fn().mockImplementation((str: string) => new TextEncoder().encode(str)),
}));

// jsdom does not implement Blob.prototype.stream — add a minimal shim so that
// saveProject can call new Blob(...).stream().pipeThrough(...) without crashing.
if (!Blob.prototype.stream) {
    Object.defineProperty(Blob.prototype, 'stream', {
        configurable: true,
        writable: true,
        value: function () {
            return { pipeThrough: (_: any) => 'mock-piped-stream' };
        },
    });
}

// Replace Response so save/load functions get predictable output without real stream plumbing
vi.stubGlobal(
    'Response',
    class MockResponse {
        constructor(_body: any) {}
        blob() {
            return Promise.resolve(new Blob([new Uint8Array([10, 20, 30])]));
        }
        arrayBuffer() {
            return Promise.resolve(new Uint8Array([1, 2, 3]).buffer);
        }
    },
);

// ---------------------------------------------------------------------------
describe('getButtonActions', () => {
    it('returns [import] when there are no images', () => {
        expect(getButtonActions([])).toEqual(['import']);
    });

    it('returns [import, save] when images exist but none are selected', () => {
        const images = [
            { id: '1', selected: false, hasPolygons: false, outdated: false } as any,
        ];
        expect(getButtonActions(images)).toEqual(['import', 'save']);
    });

    it('prepends generate when at least one image is selected', () => {
        const images = [
            { id: '1', selected: true, hasPolygons: false, outdated: false } as any,
        ];
        const result = getButtonActions(images);
        expect(result[0]).toBe('generate');
        expect(result).not.toContain('export');
    });

    it('includes export when all selected images have polygons and are not outdated', () => {
        const images = [
            { id: '1', selected: true, hasPolygons: true, outdated: false } as any,
        ];
        expect(getButtonActions(images)).toEqual(['generate', 'import', 'export', 'save']);
    });

    it('excludes export when any selected image is outdated', () => {
        const images = [
            { id: '1', selected: true, hasPolygons: true, outdated: true } as any,
            { id: '2', selected: true, hasPolygons: true, outdated: false } as any,
        ];
        expect(getButtonActions(images)).not.toContain('export');
    });

    it('excludes export when any selected image has no polygons', () => {
        const images = [
            { id: '1', selected: true, hasPolygons: false, outdated: false } as any,
        ];
        expect(getButtonActions(images)).not.toContain('export');
    });

    it('does not include save when there are no images even if selected elsewhere', () => {
        expect(getButtonActions([])).not.toContain('save');
    });
});

// ---------------------------------------------------------------------------
describe('saveProject', () => {
    it('sets anchor href and download filename, clicks the anchor, and revokes the URL', async () => {
        const anchor = {
            href: '',
            download: '',
            click: vi.fn(),
        } as unknown as HTMLAnchorElement;

        await saveProject('MyProject', new Uint8Array([1, 2, 3]), anchor);

        expect(anchor.download).toBe('MyProject.ipp');
        expect(anchor.href).toBe('blob:mock-url');
        expect(anchor.click).toHaveBeenCalledTimes(1);
        expect(URL.createObjectURL).toHaveBeenCalled();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
});

// ---------------------------------------------------------------------------
describe('loadProject', () => {
    it('returns a Uint8Array from the decompressed file', async () => {
        const mockFile = {
            stream: vi.fn().mockReturnValue({
                pipeThrough: vi.fn().mockReturnValue('mock-decompressed-stream'),
            }),
        } as unknown as File;

        const result = await loadProject(mockFile);

        expect(result).toBeInstanceOf(Uint8Array);
        expect(result.length).toBeGreaterThanOrEqual(0);
    });
});

// ---------------------------------------------------------------------------
describe('exportProject', () => {
    beforeEach(() => {
        (global.OffscreenCanvas as any).prototype.convertToBlob = vi
            .fn()
            .mockResolvedValue(new Blob([new Uint8Array([255, 0, 0])]));
    });

    it('creates a zip archive and triggers a download with the correct filename', async () => {
        const anchor = {
            href: '',
            download: '',
            click: vi.fn(),
        } as unknown as HTMLAnchorElement;

        const results = [
            {
                name: 'sprite',
                img: { width: 10, height: 10 } as ImageBitmap,
                config: { threshold: 128 },
            } as any,
        ];

        await exportProject(results, 'GameAssets', anchor);

        expect(anchor.download).toBe('GameAssets.zip');
        expect(anchor.click).toHaveBeenCalledTimes(1);
        expect(URL.createObjectURL).toHaveBeenCalled();
        expect(URL.revokeObjectURL).toHaveBeenCalled();
    });
});
