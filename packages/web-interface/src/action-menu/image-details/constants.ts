import type { ImageConfigKey } from "../../types";

export const IMAGE_SETTING_RANGES: Record<ImageConfigKey, { min: number; max: number; }> = {
    maxPointCount: { min: 1, max: 100 },
    alphaThreshold: { min: 0, max: 256 },
    minimalDistance: { min: 1, max: 256 },
};

export const SETTING_ORDER: ImageConfigKey[] = [
    'maxPointCount',
    'alphaThreshold',
    'minimalDistance',
];