import type { ImageConfig, ImageConfigKey, ImagePolygonizerInstance } from 'image-polygonizer';

export type ButtonAction = 'generate' | 'import' | 'export' | 'save' | 'none';

export type DrawItem = 'alpha' | 'contour' | 'polygon' | 'triangles';

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
  | 'switchLanguage'
  | 'updatePolygonInfo';

export type LanguageKey = 'en' | 'es' | 'fr' | 'de' | 'pl' | 'ru' | 'ua';

export type SupportedImageFormats = 'png' | 'webp';

export type ButtonActionCallback = (action: ButtonAction) => void;

export type SettingChangeCallback = (id: ImageConfigKey, value: number) => void;

export type ImageActionCallback = (action: ReducerAction, id: string, data?: any) => void;

export type ReducerState = {
  languageIndex: number;
  isInit: boolean;
  currentAction: ButtonAction;
  currentImage: ImageConfig | null;
  currentLanguage: LanguageKey;
  imagePolygonizer: ImagePolygonizerInstance;
  images: ImageConfig[];
  disabled: boolean;
  buttonActions: ButtonAction[];
  hasCancelFileListener: boolean;
};

export type ReducerMiddleware = (state: ReducerState, payload?: any) => ReducerState;

export type ReducerEvent = { type: ReducerAction; payload?: any };

export type SettingChangePayload = { id: string; value: number };
