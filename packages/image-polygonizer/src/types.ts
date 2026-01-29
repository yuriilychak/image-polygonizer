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
}

export interface ImagePolygonizerInstance {
    importImages(files: FileList): Promise<ImageConfig[]>;
    polygonize(polygonizeImages: ImageConfig[]): Promise<void>;
}

type ThreadInputDataByType = {
    projectImport: { files: File[] };
    projectExport: { projectId: string; format: 'zip' | 'json' };
    projectSave: { projectId: string; snapshot: ArrayBuffer };
    polygonize: { imageId: string; maxVertices: number };
    addImages: File;
};

type ThreadOutputDataByType = {
    projectImport: { files: File[] };
    projectExport: { projectId: string; format: 'zip' | 'json' };
    projectSave: { projectId: string; snapshot: ArrayBuffer };
    polygonize: { imageId: string; maxVertices: number };
    addImages: ImageConfig;
};

export type ThreadInput<T extends ThreadType = ThreadType> = {
    type: T;
    data: ThreadInputDataByType[T];
};

export type ThreadOutput<T extends ThreadType = ThreadType> = ThreadOutputDataByType[T];