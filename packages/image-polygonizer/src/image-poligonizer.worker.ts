import WasmWrapper from "./wasm-wrapper";
import { fileToImageConfig, imageBitmapToRgbaPixels } from "./helpers";
import { ImageConfigSerialization } from "./image-config-serialization";

import type { ImageConfig, ThreadInput, ThreadOutput } from "./types";

const wasm = new WasmWrapper();
let resolveWasmReady!: () => void;
const wasmReady = new Promise<void>(resolve => { resolveWasmReady = resolve; });

self.onmessage = async ({ data }: MessageEvent<ThreadInput>) => {
    let message: ThreadOutput<any>;
    const transferrable: Transferable[] = [];

    switch (data.type) {
        case 'init':
            await wasm.initBuffer(data.data as ArrayBuffer);
            resolveWasmReady();
            message = undefined;
            break;
        case 'addImages':
            message = await fileToImageConfig(data.data as File);
            transferrable.push(message.src);
            break;
        case 'projectImport': {
            const config = await ImageConfigSerialization.deserialize(data.data as Uint8Array);
            message = config;
            transferrable.push(config.src);
            transferrable.push(config.polygonInfo.buffer);
            break;
        }
        case 'projectSave': {
            const serialized = await ImageConfigSerialization.serialize(data.data as ImageConfig);
            message = serialized;
            transferrable.push(serialized.buffer);
            break;
        }
        case 'polygonize':
            await wasmReady;
            const { id, src, config } = data.data as ImageConfig;
            const pixels = await imageBitmapToRgbaPixels(src);
            const polygonData = wasm.polygonize(
                pixels, src.width, src.height,
                config.alphaThreshold, config.minimalDistance, config.maxPointCount
            );
            message = { id, data: polygonData };
            transferrable.push(polygonData.buffer);
            break;
        default:
            message = { type: 'error', data: 'Unknown thread input type' };
    }

    //@ts-ignore
    self.postMessage(message, transferrable);
};