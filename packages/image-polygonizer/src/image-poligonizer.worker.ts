import { extendBitMask } from "./bit-mask-extend";
import { extendSimplifiedContourToCoverOriginal } from "./extend";
import { filterContoursContainedInOthers } from "./filter-contours";
import { fileToImageConfig, imageBitmapToRgbaPixels, packAlphaMaskBits } from "./helpers";
import { extractAllOuterContours } from "./marching-sqares";
import { simplifyClosedPixelContourRDPNoSelfIntersections } from "./rdp";
import { iterativeRelaxAndSimplifyClosedContourFast } from "./relaxation";
import { refineCoveringContourBySlidingEdgesGreedy } from "./shrink";

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
            const offset = 32;
            const outline = 2;
            const maskW = src.width + 2 * offset;
            const maskH = src.height + 2 * offset;
            // alphaMask: padded, size maskW×maskH — used for display
            const alphaMask = packAlphaMaskBits(pixels, src.width, src.height, config.alphaThreshold, offset);
            // extendedMask: dilated version, same coordinate space — used for contour + pixel checks
            const extendedMask = extendBitMask(alphaMask, maskW, maskH, outline);
            // contours are in alphaMask/extendedMask coordinate space (default padding=1)
            const rawContours = extractAllOuterContours(extendedMask, maskW, maskH);
            const polygons = rawContours.map(contour => simplifyClosedPixelContourRDPNoSelfIntersections(contour, config.minimalDistance));
            const postSimplifyPolygons = polygons
                .map((polygon) => iterativeRelaxAndSimplifyClosedContourFast(polygon, 0.008, 170, 260, 120, config.minimalDistance))
                .map((contour, index) => extendSimplifiedContourToCoverOriginal(rawContours[index], contour))
                .map((contour, index) => refineCoveringContourBySlidingEdgesGreedy(rawContours[index], contour));
            const filteredPolygons = filterContoursContainedInOthers(postSimplifyPolygons);
            message = { id, data: { alphaMask: extendedMask, contours: rawContours, polygons: filteredPolygons, config, offset, outline } };
            transferrable.push(extendedMask.buffer);
            break;
        default:
            message = { type: 'error', data: 'Unknown thread input type' };
    }

    //@ts-ignore
    self.postMessage(message, transferrable);
};