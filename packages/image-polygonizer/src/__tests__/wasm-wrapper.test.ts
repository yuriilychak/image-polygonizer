import WasmWrapper from '../wasm-wrapper';

describe('WasmWrapper', () => {
    let wrapper: WasmWrapper;
    let mockMemoryBuffer: ArrayBuffer;
    let mockMalloc: ReturnType<typeof vi.fn>;
    let mockFree: ReturnType<typeof vi.fn>;
    let mockPolygonize: ReturnType<typeof vi.fn>;
    let mockStart: ReturnType<typeof vi.fn>;
    let mockExports: any;
    let mockTable: any;

    beforeEach(() => {
        wrapper = new WasmWrapper();
        mockMemoryBuffer = new ArrayBuffer(65536); // 64 KB
        mockMalloc = vi.fn().mockReturnValue(0);
        mockFree = vi.fn();
        mockPolygonize = vi.fn().mockReturnValue([0, 4]); // ptr=0, len=4
        mockStart = vi.fn();
        mockTable = { grow: vi.fn().mockReturnValue(0), set: vi.fn() };
        mockExports = {
            memory: { buffer: mockMemoryBuffer },
            __wbindgen_start: mockStart,
            __wbindgen_malloc: mockMalloc,
            __wbindgen_free: mockFree,
            __wbindgen_externrefs: mockTable,
            polygonize: mockPolygonize,
        };

        vi.spyOn(WebAssembly, 'compile').mockResolvedValue({} as WebAssembly.Module);
        vi.spyOn(WebAssembly.Module, 'imports').mockReturnValue([
            { module: 'wbg', name: 'a', kind: 'function' },
        ]);
        vi.spyOn(WebAssembly, 'instantiate').mockResolvedValue({ exports: mockExports } as any);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── initBuffer ──────────────────────────────────────────────────

    describe('initBuffer', () => {
        it('calls WebAssembly.compile with the provided bytes', async () => {
            const bytes = new ArrayBuffer(8);
            await wrapper.initBuffer(bytes);
            expect(WebAssembly.compile).toHaveBeenCalledWith(bytes);
        });

        it('calls WebAssembly.Module.imports to retrieve the namespace', async () => {
            const bytes = new ArrayBuffer(8);
            const fakeModule = {} as WebAssembly.Module;
            vi.mocked(WebAssembly.compile).mockResolvedValue(fakeModule);
            await wrapper.initBuffer(bytes);
            expect(WebAssembly.Module.imports).toHaveBeenCalledWith(fakeModule);
        });

        it('calls WebAssembly.instantiate with the compiled module and an import object keyed by ns', async () => {
            const bytes = new ArrayBuffer(8);
            const fakeModule = {} as WebAssembly.Module;
            vi.mocked(WebAssembly.compile).mockResolvedValue(fakeModule);
            await wrapper.initBuffer(bytes);
            const [calledModule, imports] = vi.mocked(WebAssembly.instantiate).mock.calls[0] as [WebAssembly.Module, WebAssembly.Imports];
            expect(calledModule).toBe(fakeModule);
            expect(imports).toHaveProperty('wbg');
            expect(typeof (imports['wbg'] as any).__wbindgen_init_externref_table).toBe('function');
        });

        it('calls __wbindgen_start after instantiation', async () => {
            await wrapper.initBuffer(new ArrayBuffer(8));
            expect(mockStart).toHaveBeenCalledOnce();
        });
    });

    // ── polygonize ──────────────────────────────────────────────────

    describe('polygonize', () => {
        const pixels = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]);

        beforeEach(async () => {
            await wrapper.initBuffer(new ArrayBuffer(8));
        });

        it('calls __wbindgen_malloc to allocate memory for pixels', () => {
            wrapper.polygonize(pixels, 2, 2, 128, 4, 16);
            expect(mockMalloc).toHaveBeenCalledWith(pixels.length, 1);
        });

        it('calls the wasm polygonize function with correct arguments', () => {
            wrapper.polygonize(pixels, 3, 4, 10, 5, 20);
            expect(mockPolygonize).toHaveBeenCalledWith(
                0,           // ptr returned by malloc
                pixels.length,
                3,           // width
                4,           // height
                10,          // alphaThreshold
                5,           // minimalDistance
                20,          // maxPointCount
            );
        });

        it('calls __wbindgen_free with the returned pointer and byte size', () => {
            mockPolygonize.mockReturnValue([16, 4]); // ptr=16, len=4 (u16 elements)
            wrapper.polygonize(pixels, 2, 2, 128, 4, 16);
            // free(ptr, byteLen, align) → byteLen = len * 2
            expect(mockFree).toHaveBeenCalledWith(16, 8, 2);
        });

        it('returns a Uint16Array sliced from wasm memory', () => {
            // Pixels (8 bytes) are written at ptr=0 by #passArray8ToWasm.
            // Return result at byte offset 256 (u16 word index 128) to avoid overlap.
            const resultBytePtr = 256;
            const resultLen = 4;
            const view = new Uint16Array(mockMemoryBuffer);
            const wordBase = resultBytePtr >>> 1; // 128
            view[wordBase + 0] = 111;
            view[wordBase + 1] = 222;
            view[wordBase + 2] = 333;
            view[wordBase + 3] = 444;
            mockPolygonize.mockReturnValue([resultBytePtr, resultLen]);

            const result = wrapper.polygonize(pixels, 2, 2, 128, 4, 16);

            expect(result).toBeInstanceOf(Uint16Array);
            expect(result.length).toBe(4);
            expect(Array.from(result)).toEqual([111, 222, 333, 444]);
        });

        it('returns an independent copy (not a view) of wasm memory', () => {
            // Use a result area well away from the pixel data at ptr=0
            const resultBytePtr = 256;
            const view = new Uint16Array(mockMemoryBuffer);
            const wordBase = resultBytePtr >>> 1;
            view[wordBase + 0] = 10;
            view[wordBase + 1] = 20;
            mockPolygonize.mockReturnValue([resultBytePtr, 2]);

            const result = wrapper.polygonize(pixels, 2, 1, 128, 4, 16);

            // Mutate mock memory after the call
            view[wordBase + 0] = 99;
            view[wordBase + 1] = 99;

            // Result should not reflect the mutation
            expect(result[0]).toBe(10);
            expect(result[1]).toBe(20);
        });
    });

    // ── __wbindgen_init_externref_table ─────────────────────────────

    describe('__wbindgen_init_externref_table (via initBuffer)', () => {
        it('grows the externref table and sets the first slot to undefined', async () => {
            await wrapper.initBuffer(new ArrayBuffer(8));

            // Retrieve the import that was passed to WebAssembly.instantiate
            const [, imports] = vi.mocked(WebAssembly.instantiate).mock.calls[0] as [WebAssembly.Module, WebAssembly.Imports];
            const initFn = (imports['wbg'] as any).__wbindgen_init_externref_table as Function;

            // Call the init function with the mock table already in mockExports
            initFn();

            expect(mockTable.grow).toHaveBeenCalledWith(4);
            expect(mockTable.set).toHaveBeenCalledWith(0, undefined);
        });
    });
});
