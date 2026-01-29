import { fileToImageConfig } from "./helpers";

import type { ThreadInput, ThreadOutput } from "./types";

self.onmessage = async ({ data }: MessageEvent<ThreadInput>) => {
    let message: ThreadOutput<any>;
    switch (data.type) {
        case 'addImages':
            message = await fileToImageConfig(data.data as File);
            break;
        case 'polygonize':
            message = { type: 'polygonizeComplete', data: null };
            break;
        default:
            message = { type: 'error', data: 'Unknown thread input type' };
    }

    self.postMessage(message);
};