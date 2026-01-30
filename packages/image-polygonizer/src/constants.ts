import type { ImageSetting } from "./types";

export const DEFAULT_CONFIG: ImageSetting = {
    maxPointCount: 32,
    alphaThreshold: 1,
    minimalDistance: 8,
};

export const NOOP = (): void => { };