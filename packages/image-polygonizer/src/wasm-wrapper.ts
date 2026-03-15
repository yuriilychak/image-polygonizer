export default class WasmWrapper {
    #wasm: WebAssembly.Exports | null = null;
    #cachedUint8Memory: Uint8Array | null = null;
    #cachedUint16Memory: Uint16Array | null = null;
    #vecLen: number = 0;

    async initBuffer(bytes: ArrayBuffer): Promise<void> {
        const module = await WebAssembly.compile(bytes);
        const ns = WebAssembly.Module.imports(module)[0].module;
        const imports = this.#getImports(ns);
        const instance = await WebAssembly.instantiate(module, imports);
        this.#wasm = instance.exports;
        this.#cachedUint8Memory = null;
        this.#cachedUint16Memory = null;
        (this.#wasm.__wbindgen_start as Function)();
    }

    polygonize(
        pixels: Uint8Array,
        width: number,
        height: number,
        alphaThreshold: number,
        minimalDistance: number,
        maxPointCount: number,
    ): Uint16Array {
        const wasm = this.#wasm!;
        const ptr = this.#passArray8ToWasm(pixels, wasm.__wbindgen_malloc as Function);
        const len = this.#vecLen;
        const ret = (wasm.polygonize as Function)(ptr, len, width, height, alphaThreshold, minimalDistance, maxPointCount) as [number, number];
        const result = this.#getUint16Memory().subarray(ret[0] >>> 1, (ret[0] >>> 1) + ret[1]).slice();
        (wasm.__wbindgen_free as Function)(ret[0], ret[1] * 2, 2);
        return result;
    }

    #getUint8Memory(): Uint8Array {
        if (this.#cachedUint8Memory === null || this.#cachedUint8Memory.byteLength === 0) {
            this.#cachedUint8Memory = new Uint8Array((this.#wasm!.memory as WebAssembly.Memory).buffer);
        }
        return this.#cachedUint8Memory;
    }

    #getUint16Memory(): Uint16Array {
        if (this.#cachedUint16Memory === null || this.#cachedUint16Memory.byteLength === 0) {
            this.#cachedUint16Memory = new Uint16Array((this.#wasm!.memory as WebAssembly.Memory).buffer);
        }
        return this.#cachedUint16Memory;
    }

    #passArray8ToWasm(arg: Uint8Array, malloc: Function): number {
        const ptr = malloc(arg.length, 1) >>> 0;
        this.#getUint8Memory().set(arg, ptr);
        this.#vecLen = arg.length;
        return ptr;
    }

    #getImports(ns: string): WebAssembly.Imports {
        return {
            [ns]: {
                __wbindgen_init_externref_table: () => {
                    const table = (this.#wasm as any).__wbindgen_externrefs as WebAssembly.Table;
                    const offset = table.grow(4);
                    table.set(0, undefined);
                    table.set(offset + 0, undefined);
                    table.set(offset + 1, null);
                    table.set(offset + 2, true);
                    table.set(offset + 3, false);
                },
            },
        };
    }
}
