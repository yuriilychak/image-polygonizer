type UintArray = Uint8Array | Uint16Array;

export default class WasmWrapper {
    #wasm: WebAssembly.Exports | null = null;
    #cachedUint: UintArray[] = [];
    #vecLen: number = 0;

    async initBuffer(bytes: ArrayBuffer): Promise<void> {
        const module = await WebAssembly.compile(bytes);
        const ns = WebAssembly.Module.imports(module)[0].module;
        const imports = this.#getImports(ns);
        const instance = await WebAssembly.instantiate(module, imports);
        this.#wasm = instance.exports;
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
        const result = this.#getUint(1).subarray(ret[0] >>> 1, (ret[0] >>> 1) + ret[1]).slice();
        (wasm.__wbindgen_free as Function)(ret[0], ret[1] * 2, 2);
        return result;
    }

    #getUint(index: 0): Uint8Array;
    #getUint(index: 1): Uint16Array;
    #getUint(index: 0 | 1): UintArray {
        const buf = (this.#wasm!.memory as WebAssembly.Memory).buffer;
        if (this.#cachedUint.length === 0 || this.#cachedUint[0].byteLength === 0) {
            this.#cachedUint = [new Uint8Array(buf), new Uint16Array(buf)];
        }
        return this.#cachedUint[index];
    }

    #passArray8ToWasm(arg: Uint8Array, malloc: Function): number {
        const ptr = malloc(arg.length, 1) >>> 0;
        this.#getUint(0).set(arg, ptr);
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
                    [undefined, null, true, false].forEach((v, i) => table.set(offset + i, v));
                },
            },
        };
    }
}
