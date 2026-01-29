import type { ImageSetting } from "./types";

export const DEFAULT_CONFIG: ImageSetting = {
    maxPointCount: 32,
    alphaThreshold: 0,
    minimalDistance: 8,
};

export const NOOP = (): void => {};