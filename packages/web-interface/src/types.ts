import { ImagePolygonizer } from "image-polygonizer";

export type ButtonAction = 'generate' | 'import' | 'export' | 'save' | 'none';

export type ImageConfigKey = 'maxPointCount' | 'alphaThreshold' | 'minimalDistance';

export type ReducerAction =
  | 'init'
  | 'addImages'
  | 'removeImage'
  | 'updateImageConfig'
  | 'setCurrentImage'
  | 'setDisabled'
  | 'setEnabled'
  | 'toggleImage'
  | 'setHasCancelFileListener'
  | 'renameImage'
  | 'setAction'
  | 'resetAction'
  | 'switchLanguage';

export type CharAction = ReducerAction;

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

export type ButtonActionCallback = (action: ButtonAction) => void;

export type SettingChangeCallback = (id: ImageConfigKey, value: number) => void;

export type ImageActionCallback = (action: ReducerAction, id: string, data?: any) => void;

export type ReducerState = {
  languageIndex: number;
  isInit: boolean;
  currentAction: ButtonAction;
  currentImage: ImageConfig | null;
  currentLanguage: string;
  imagePolygonizer: ImagePolygonizer;
  images: ImageConfig[];
  disabled: boolean;
  buttonActions: ButtonAction[];
  hasCancelFileListener: boolean;
};

export type ReducerMiddleware = (state: ReducerState, payload?: any) => ReducerState;

export type ReducerEvent = { type: ReducerAction; payload?: any };

export type SettingChangePayload = { id: string; value: number };

export type ImageActionPayload<T = any> = { id: string; data?: T };
