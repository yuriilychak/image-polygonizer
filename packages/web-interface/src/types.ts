import type { ImageConfig, ImageConfigKey, ImagePolygonizerInstance } from 'image-polygonizer';

export type ButtonAction = 'generate' | 'import' | 'export' | 'save' | 'none';

export type DrawItem = 'alpha' | 'contour' | 'polygon' | 'triangles';

export type CropOption = 'none' | 'alpha' | 'polygon';

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
  | 'updatePolygonInfo'
  | 'toggleSelectAllImages'
  | 'loadingFinish'
  | 'importProject'
  | 'projectNameChange'
  | 'openExportModal'
  | 'closeExportModal'
  | 'toggleSharedExportConfig';

export type ExportAction = 'exportPolygons' | 'exportTriangles' | 'cancelExport' | 'submitExport';

export type LanguageKey = 'en' | 'es' | 'fr' | 'de' | 'pl' | 'ru' | 'ua';

export type SupportedImageFormats = 'png' | 'webp';

export type ButtonActionCallback = (action: ButtonAction) => void;

export type SettingChangeCallback = (id: ImageConfigKey, value: number) => void;

export type ImageActionCallback = (action: ReducerAction, id: string, data?: any) => void;

export type SharedExportConfig = {
  exportPolygons: boolean;
  exportTriangles: boolean;
};

export type ExportConfig = {
  shared: SharedExportConfig;
  fileConfig: Record<string, object>;
}

export type ReducerState = {
  isExportModalOpen: boolean;
  projectName: string;
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
  exportConfig: ExportConfig;
};

export type ReducerMiddleware = (state: ReducerState, payload?: any) => ReducerState;

export type ReducerEvent = { type: ReducerAction; payload?: any };

export type SettingChangePayload = { id: string; value: number };
