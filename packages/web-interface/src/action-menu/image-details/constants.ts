import type { ImageConfigKey } from "../../types";

export const IMAGE_SETTING_RANGES: Record<ImageConfigKey, { min: number; max: number; }> = {
    maxPointCount: { min: 4, max: 256 },
    alphaThreshold: { min: 1, max: 255 },
    minimalDistance: { min: 1, max: 256 },
};

export const RANGE_INPUT_STEP = 1;

export const SETTING_ORDER: ImageConfigKey[] = [
    'maxPointCount',
    'alphaThreshold',
    'minimalDistance',
];