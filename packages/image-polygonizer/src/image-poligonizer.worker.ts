import { filterContoursContainedInOthers } from "./filter-contours";
import { fileToImageConfig, imageBitmapToRgbaPixels } from "./helpers";
import { ImageConfigSerialization } from "./image-config-serialization";
import PolygonData from "./polygon-data";
import { optimizeTrianglesByEdgeFlipRepeated } from "./triangle-retopology";
import { triangulateSimplePolygonAvoidSlivers } from "./triangulate";

import type { ImageConfig, ThreadInput, ThreadOutput } from "./types";

declare const wasm_bindgen: any;
(self as any).importScripts('./image-poligonizer.algo.js');
const wasmReady = wasm_bindgen('./image-poligonizer.algo_bg.wasm');

function unpackContours(buf: Uint8Array): Uint16Array[] {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const n = view.getUint32(0, true);
    const lengths: number[] = [];
    for (let i = 0; i < n; i++) {
        lengths.push(view.getUint32(4 + i * 4, true));
    }
    let offset = 4 + n * 4;
    const contours: Uint16Array[] = [];
    for (let i = 0; i < n; i++) {
        const len = lengths[i];
        const contour = new Uint16Array(buf.buffer, buf.byteOffset + offset, len);
        contours.push(contour.slice());
        offset += len * 2;
    }
    return contours;
}

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
            const offset = 32;
            const outline = 2;
            const maskW = src.width + 2 * offset;
            const maskH = src.height + 2 * offset;
            const alphaMask = wasm_bindgen.pack_alpha_mask_bits(pixels, src.width, src.height, config.alphaThreshold, offset) as Uint8Array;
            const extendedMask = wasm_bindgen.extend_bit_mask(alphaMask, maskW, maskH, outline) as Uint8Array;
            const rawContoursPacked = wasm_bindgen.extract_all_outer_contours(extendedMask, maskW, maskH, 1) as Uint8Array;
            const rawContours = unpackContours(rawContoursPacked);
            const polygons = rawContours.map(contour =>
                wasm_bindgen.contour_to_polygon(contour, config.minimalDistance, config.maxPointCount) as Uint16Array
            );
            console.log('WASM3');
            const filteredPolygons = filterContoursContainedInOthers(polygons);
            const triangles = filteredPolygons.map(polygon => {
                const firstStep = triangulateSimplePolygonAvoidSlivers(polygon);
                const secondStep = optimizeTrianglesByEdgeFlipRepeated(polygon, firstStep, 10);

                return secondStep;
            });
            const polygonData = PolygonData.getInstance().serialize(extendedMask, rawContours, filteredPolygons, triangles, config, offset, outline);

            message = { id, data: polygonData };
            transferrable.push(polygonData.buffer);
            break;
        default:
            message = { type: 'error', data: 'Unknown thread input type' };
    }

    //@ts-ignore
    self.postMessage(message, transferrable);
};