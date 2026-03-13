export type ImageConfigKey = 'maxPointCount' | 'alphaThreshold' | 'minimalDistance';

export type ImageSetting = Record<ImageConfigKey, number>;

export type ThreadType =
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
    importImages(files: FileList): Promise<ImageConfig[]>;
    polygonize(polygonizeImages: ImageConfig[]): Promise<ImageActionPayload<Uint16Array>[]>;
    serializeImages(images: ImageConfig[]): Promise<Uint8Array>;
    deserializeImages(data: Uint8Array): Promise<ImageConfig[]>;
}

type ThreadInputDataByType = {
    projectImport: Uint8Array;
    projectExport: { projectId: string; format: 'zip' | 'json' };
    projectSave: ImageConfig;
    polygonize: ImageConfig;
    addImages: File;
};

type ThreadOutputDataByType = {
    projectImport: ImageConfig;
    projectExport: { projectId: string; format: 'zip' | 'json' };
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