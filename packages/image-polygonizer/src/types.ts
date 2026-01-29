export type ImageConfigKey = 'maxPointCount' | 'alphaThreshold' | 'minimalDistance';

export type ImageSetting = Record<ImageConfigKey, number>;

export interface ImageMetadata {
    label: string;
    type: string;
    src: ImageBitmap;
}

export interface ImageConfig extends ImageMetadata {
    id: string;
    selected: boolean;
    hasPolygons: boolean;
    outdated: boolean;
    config: ImageSetting;
}

export interface ImagePolygonizerInstance {
    importImages(files: FileList): Promise<ImageConfig[]>
    polygonize(polygonizeImages: ImageConfig[]): Promise<void>
}
