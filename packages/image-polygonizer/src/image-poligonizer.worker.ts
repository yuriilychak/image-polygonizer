import { fileToImageConfig, imageBitmapToRgbaPixels, packAlphaMaskBits } from "./helpers";
import { extractAllOuterContours } from "./marching-sqares";
import { simplifyContourU16Advanced } from "./rdp";

import type { ImageConfig, ThreadInput, ThreadOutput } from "./types";

self.onmessage = async ({ data }: MessageEvent<ThreadInput>) => {
    let message: ThreadOutput<any>;
    const transferrable: Transferable[] = [];

    switch (data.type) {
        case 'addImages':
            message = await fileToImageConfig(data.data as File);
            transferrable.push(message.src);
            break;
        case 'polygonize':
            const { id, src, config } = data.data as ImageConfig;
            const pixels = await imageBitmapToRgbaPixels(src);
            const alphaMask = packAlphaMaskBits(pixels, src.width, src.height, config.alphaThreshold, 2);
            const contours = extractAllOuterContours(alphaMask, src.width + 4, src.height + 4);
            const polygons = contours.map(contour => 
                simplifyContourU16Advanced(contour, { epsilon: config.minimalDistance, maxPoints: config.maxPointCount })
            );
            message = { id, data: { alphaMask, contours, polygons, config } };
            transferrable.push(alphaMask.buffer);
            for (const contour of contours) {
                transferrable.push(contour.buffer);
            }
            break;
        default:
            message = { type: 'error', data: 'Unknown thread input type' };
    }

    //@ts-ignore
    self.postMessage(message, transferrable);
};