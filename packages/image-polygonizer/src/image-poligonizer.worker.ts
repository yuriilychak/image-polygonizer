import { fileToImageConfig, imageBitmapToRgbaPixels } from "./helpers";
import { ImageConfigSerialization } from "./image-config-serialization";

import type { ImageConfig, ThreadInput, ThreadOutput } from "./types";

declare const wasm_bindgen: any;
(self as any).importScripts('./image-poligonizer.algo.js');
const wasmReady = wasm_bindgen('./image-poligonizer.algo_bg.wasm');

self.onmessage = async ({ data }: MessageEvent<ThreadInput>) => {
    let message: ThreadOutput<any>;
    const transferrable: Transferable[] = [];

    switch (data.type) {
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
            const polygonData = wasm_bindgen.polygonize(
                pixels, src.width, src.height,
                config.alphaThreshold, config.minimalDistance, config.maxPointCount
            ) as Uint16Array;
            message = { id, data: polygonData };
            transferrable.push(polygonData.buffer);
            break;
        default:
            message = { type: 'error', data: 'Unknown thread input type' };
    }

    //@ts-ignore
    self.postMessage(message, transferrable);
};