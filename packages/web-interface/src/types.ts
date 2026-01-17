

export type ButtonAction = 'generate' | 'import' | 'export' | 'save';

export type ImageConfigKey = 'maxPointCount' | 'alphaThreshold' | 'minimalDistance';

export type CharAction = 'add' | 'remove' | 'select' | 'check';

export type ImageConfig = Record<ImageConfigKey, number>;

export type ImageData = {
    id: string;
    label: string;
    config: ImageConfig;
};

export type ButtonActionCallback = (action: ButtonAction) => void;

export type SettingChangeCallback = (id: ImageConfigKey, value: number) => void;

export type ImageActionCallback = (action: string, id: string) => void;