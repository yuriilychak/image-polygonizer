import { extendBitMask } from "./bit-mask-extend";
import { extendSimplifiedContourToCoverOriginal } from "./extend";
import { filterContoursContainedInOthers } from "./filter-contours";
import { fileToImageConfig, imageBitmapToRgbaPixels, packAlphaMaskBits } from "./helpers";
import { extractAllOuterContours } from "./marching-sqares";
import { removeSmallestPitsUntilMaxPointCount } from "./point-limit";
import { simplifyClosedPixelContourRDPNoSelfIntersections } from "./rdp";
import { iterativeRelaxAndSimplifyClosedContourFast } from "./relaxation";
import { refineCoveringContourBySlidingEdgesGreedy } from "./shrink";
import { optimizeTrianglesByEdgeFlipRepeated } from "./triangle-retopology";
import { triangulateSimplePolygonAvoidSlivers } from "./triangulate";

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
            const alphaMask = packAlphaMaskBits(pixels, src.width, src.height, config.alphaThreshold, offset);
            const extendedMask = extendBitMask(alphaMask, maskW, maskH, outline);
            const rawContours = extractAllOuterContours(extendedMask, maskW, maskH);
            const polygons = rawContours.map(contour => {
                const firstStep = simplifyClosedPixelContourRDPNoSelfIntersections(contour, config.minimalDistance);
                const secondStep = iterativeRelaxAndSimplifyClosedContourFast(firstStep, 0.008, 170, 260, 120, config.minimalDistance);
                const thirdStep = removeSmallestPitsUntilMaxPointCount(secondStep, config.maxPointCount);
                const fouthStep = extendSimplifiedContourToCoverOriginal(contour, thirdStep);
                const fifthStep = refineCoveringContourBySlidingEdgesGreedy(contour, fouthStep);

                return fifthStep;
            });
            const filteredPolygons = filterContoursContainedInOthers(polygons);
            const triangles = filteredPolygons.map(polygon => {
                const firstStep = triangulateSimplePolygonAvoidSlivers(polygon);
                const secondStep = optimizeTrianglesByEdgeFlipRepeated(polygon, firstStep, 10);

                return secondStep;
            });
            message = { id, data: { alphaMask: extendedMask, contours: rawContours, polygons: filteredPolygons, triangles, config, offset, outline } };
            transferrable.push(extendedMask.buffer);
            filteredPolygons.forEach(polygon => transferrable.push(polygon.buffer));
            triangles.forEach(triangle => transferrable.push(triangle.buffer));
            break;
        default:
            message = { type: 'error', data: 'Unknown thread input type' };
    }

    //@ts-ignore
    self.postMessage(message, transferrable);
};