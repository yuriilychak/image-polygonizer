export type ImageConfigKey = 'maxPointCount' | 'alphaThreshold' | 'minimalDistance';

export type ImageSetting = Record<ImageConfigKey, number>;

export type ThreadType =
    | 'init'
    | 'projectImport'
    | 'projectExport'
    | 'projectSave'
    | 'polygonize'
    | 'addImages';

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
    polygonInfo: Uint16Array;
}

export type ImageActionPayload<T = any> = { id: string; data?: T };

export interface ImagePolygonizerInstance {
    init(): Promise<void>;
    importImages(files: FileList): Promise<ImageConfig[]>;
    polygonize(polygonizeImages: ImageConfig[]): Promise<ImageActionPayload<Uint16Array>[]>;
    serializeImages(images: ImageConfig[]): Promise<Uint8Array>;
    deserializeImages(data: Uint8Array): Promise<ImageConfig[]>;
    exportImages(images: ImageConfig[], exportConfig: ExportConfig): Promise<ExportedImage[]>;
}

type ThreadInputDataByType = {
    init: ArrayBuffer;
    projectImport: Uint8Array;
    projectExport: { imageConfig: ImageConfig; exportConfig: ImageExportConfig };
    projectSave: ImageConfig;
    polygonize: ImageConfig;
    addImages: File;
};

type ThreadOutputDataByType = {
    init: undefined;
    projectImport: ImageConfig;
    projectExport: ExportedImage;
    projectSave: Uint8Array;
    polygonize: ImageActionPayload<Uint16Array>;
    addImages: ImageConfig;
};

export type ThreadInput<T extends ThreadType = ThreadType> = {
    type: T;
    data: ThreadInputDataByType[T];
    transfetrable?: Transferable[];
};

export type ThreadOutput<T extends ThreadType = ThreadType> = ThreadOutputDataByType[T];

export type ExportedImage = {
    name: string;
    id: string;
    img: ImageBitmap;
    config: object;
};

export type CropOption = 'none' | 'alpha' | 'polygon' | '';

export interface SharedExportConfig {
    exportPolygons: boolean;
    exportTriangles: boolean;
}

export interface ImageExportConfig extends SharedExportConfig {
    cropOption: CropOption;
}

export type CropConfig = Record<string, CropOption>;

export type ExportConfig = {
    shared: SharedExportConfig;
    fileConfig: CropConfig;
};