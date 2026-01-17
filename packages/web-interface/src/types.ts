

export type ButtonAction = 'generate' | 'import' | 'export' | 'save';

export type ImageConfigKey = 'maxPointCount' | 'alphaThreshold' | 'minimalDistance';

export type CharAction = 'add' | 'remove' | 'select' | 'check';

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
};

export type ButtonActionCallback = (action: ButtonAction) => void;

export type SettingChangeCallback = (id: ImageConfigKey, value: number) => void;

export type ImageActionCallback = (action: string, id: string) => void;

export type ReducerState = {
    images: ImageConfig[];
    currentImage: ImageConfig | null;
    disabled: boolean;
    buttonActions: ButtonAction[];
};

export type ReducerAction = 'init' | 'addImages' | 'removeImage' | 'updateImageConfig' | 'setCurrentImage' | 'setDisabled' | 'toggleImage';

export type ReducerMiddleware = (state: ReducerState, payload?: any) => ReducerState;

export type ReducerEvent = { type: ReducerAction; payload?: any };

export type SettingChangePayload = { id: string; value: number };