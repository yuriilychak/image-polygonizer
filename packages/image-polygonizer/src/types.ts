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

export type PolygonInfo = { alphaMask: Uint8Array, contours: Uint16Array[], polygons: Uint16Array[], config: ImageSetting };

export interface ImageConfig extends ImageMetadata {
    id: string;
    selected: boolean;
    hasPolygons: boolean;
    outdated: boolean;
    config: ImageSetting;
    polygonInfo: PolygonInfo;
}

export type ImageActionPayload<T = any> = { id: string; data?: T };

export interface ImagePolygonizerInstance {
    importImages(files: FileList): Promise<ImageConfig[]>;
    polygonize(polygonizeImages: ImageConfig[]): Promise<ImageActionPayload<PolygonInfo>[]>;
}

type ThreadInputDataByType = {
    projectImport: { files: File[] };
    projectExport: { projectId: string; format: 'zip' | 'json' };
    projectSave: { projectId: string; snapshot: ArrayBuffer };
    polygonize: ImageConfig;
    addImages: File;
};

type ThreadOutputDataByType = {
    projectImport: { files: File[] };
    projectExport: { projectId: string; format: 'zip' | 'json' };
    projectSave: { projectId: string; snapshot: ArrayBuffer };
    polygonize: ImageActionPayload<PolygonInfo>;
    addImages: ImageConfig;
};

export type ThreadInput<T extends ThreadType = ThreadType> = {
    type: T;
    data: ThreadInputDataByType[T];
    transfetrable?: Transferable[];
};

export type ThreadOutput<T extends ThreadType = ThreadType> = ThreadOutputDataByType[T];