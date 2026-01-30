import { fileToImageConfig, imageBitmapToRgbaPixels, packAlphaMaskBits } from "./helpers";

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
            const alphaMask = packAlphaMaskBits(pixels, src.width, src.height, config.alphaThreshold);
            message = { id, pixels, alphaMask };
            transferrable.push(alphaMask.buffer);
            transferrable.push(pixels.buffer);
            break;
        default:
            message = { type: 'error', data: 'Unknown thread input type' };
    }

    //@ts-ignore
    self.postMessage(message, transferrable);
};