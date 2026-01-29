import { DEFAULT_CONFIG } from "./constants";

import type { ThreadInput, ThreadOutput } from "./types";

self.onmessage = async ({ data }: MessageEvent<ThreadInput>) => {
    let message: ThreadOutput<any>;
    switch (data.type) {
        case 'addImages':
            const file = data.data as File;
            message = {
                label: file.name.replace(/\.[^/.]+$/, ''),
                type: file.type.replace('image/', ''),
                src: await createImageBitmap(file),
                selected: false,
                outdated: false,
                hasPolygons: false,
                id: crypto.randomUUID(),
                config: { ...DEFAULT_CONFIG },
            };
            break;
        default:
            message = { type: 'error', data: 'Unknown thread input type' };
    }

    self.postMessage(message);
};