import type { ImageConfigKey } from 'image-polygonizer';

export const IMAGE_SETTING_RANGES: { id: ImageConfigKey; min: number; max: number }[] = [
    { id: 'maxPointCount', min: 4, max: 256 },
    { id: 'alphaThreshold', min: 1, max: 255 },
    { id: 'minimalDistance', min: 1, max: 256 },
];

export const RANGE_INPUT_STEP = 1;
