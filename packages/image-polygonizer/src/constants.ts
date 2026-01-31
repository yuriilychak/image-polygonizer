import type { ImageSetting, PolygonInfo } from "./types";

export const DEFAULT_CONFIG: ImageSetting = {
    maxPointCount: 32,
    alphaThreshold: 1,
    minimalDistance: 8,
};

export const DEFAULT_POLYGON_INFO: PolygonInfo = {
    alphaMask: new Uint8Array(),
    contours: [],
    polygons: [],
    config: { ...DEFAULT_CONFIG },
};

export const NOOP = (): void => { };