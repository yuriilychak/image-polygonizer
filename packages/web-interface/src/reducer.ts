import { getButtonActions } from './helpers';
import {
  ReducerAction,
  ReducerEvent,
  ReducerMiddleware,
  ReducerState,
  ImageMetadata,
  ImageSetting,
  ImageConfig,
  SettingChangePayload,
} from './types';

const REDUCER_ACTIONS: Record<ReducerAction, ReducerMiddleware> = {
  init: state => state,
  addImages: (state, payload: ImageMetadata[]) => {
    if (!Array.isArray(payload)) return state;

    const defaultConfig: ImageSetting = {
      maxPointCount: 100,
      alphaThreshold: 0.5,
      minimalDistance: 10,
    };

    const newImages: ImageConfig[] = payload.map((metadata: ImageMetadata) => ({
      ...metadata,
      selected: false,
      outdated: false,
      hasPolygons: false,
      id: crypto.randomUUID(),
      config: { ...defaultConfig },
    }));
    return {
      ...state,
      images: [...state.images, ...newImages],
      currentImage: state.currentImage || newImages[0],
      disabled: false,
      buttonActions: getButtonActions([...state.images, ...newImages]),
    };
  },
  removeImage: (state, imageId: string) => {
    const newImages = state.images.filter(img => img.id !== imageId);
    let newCurrentImage = state.currentImage;

    if (state.currentImage?.id === imageId) {
      newCurrentImage = newImages.length > 0 ? newImages[0] : null;
    }

    return {
      ...state,
      images: newImages,
      currentImage: newCurrentImage,
      buttonActions: getButtonActions(newImages),
    };
  },
  updateImageConfig: (state, { id, value }: SettingChangePayload) => {
    const { currentImage, images } = state;
    if (!currentImage) return state;

    const nextImage = {
      ...currentImage,
      config: { ...currentImage.config, [id]: value },
    } as ImageConfig;

    return {
      ...state,
      currentImage: nextImage,
      images: images.map(img => (img.id === id ? nextImage : img)),
    };
  },
  setCurrentImage: (state, imageId: string) => {
    const image = state.images.find(img => img.id === imageId);
    return {
      ...state,
      currentImage: image || null,
    };
  },
  toggleImage: (state, imageId: string) => {
    const newImages = state.images.map(img =>
      img.id === imageId ? { ...img, selected: !img.selected } : img
    );

    return {
      ...state,
      images: newImages,
      buttonActions: getButtonActions(newImages),
    };
  },
  setDisabled: state => ({ ...state, disabled: true }),
};

export const INITIAL_STATE: ReducerState = {
  images: [],
  currentImage: null,
  disabled: false,
  buttonActions: ['import'],
};

export const REDUCER = (state: ReducerState, { type, payload }: ReducerEvent) =>
  REDUCER_ACTIONS[type](state, payload);
