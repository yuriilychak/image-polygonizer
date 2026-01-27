import { ImagePolygonizer } from 'image-polygonizer';
import { getButtonActions, imageMetadataToConfig } from './helpers';
import { LANGUAGE_LIST } from './constants';

import type {
  ReducerAction,
  ReducerEvent,
  ReducerMiddleware,
  ReducerState,
  ImageMetadata,
  ImageConfig,
  SettingChangePayload,
  ImageActionPayload,
  ButtonAction,
} from './types';

const REDUCER_ACTIONS: Record<ReducerAction, ReducerMiddleware> = {
  init: state => ({ ...state, isInit: true }),
  addImages: (state, payload: ImageMetadata[]) => {
    const newImages: ImageConfig[] = payload.map((metadata: ImageMetadata) =>
      imageMetadataToConfig(metadata)
    );
    const images = state.images.concat(newImages);
    const buttonActions = getButtonActions(images);
    const currentImage = state.currentImage || newImages[0];

    return { ...state, images, currentImage, disabled: false, buttonActions };
  },
  removeImage: (state, { id }: ImageActionPayload) => {
    const { currentImage: prevImage } = state;
    const removedImage = state.images.find(img => img.id === id);

    if (removedImage) {
      removedImage.src.close();
    }

    const images = state.images.filter(img => img.id !== id);
    const currentImage = prevImage && prevImage.id === id ? images[0] || null : prevImage;
    const buttonActions = getButtonActions(images);

    return { ...state, images, currentImage, buttonActions };
  },
  updateImageConfig: (state, { id, value }: SettingChangePayload) => {
    const { currentImage: prevImage, images: prevImages } = state;

    if (!prevImage) {
      return state;
    }

    const config = { ...prevImage.config, [id]: value };
    const currentImage = { ...prevImage, outdated: prevImage.hasPolygons, config };
    const images = prevImages.map(img => (img.id === currentImage.id ? currentImage : img));

    return { ...state, currentImage, images };
  },
  setCurrentImage: (state, { id }: ImageActionPayload) => ({
    ...state,
    currentImage: state.images.find(img => img.id === id) || null,
  }),
  toggleImage: (state, { id }: ImageActionPayload) => {
    const images = state.images.map(img =>
      img.id === id ? { ...img, selected: !img.selected } : img
    );
    const buttonActions = getButtonActions(images);

    return { ...state, images, buttonActions };
  },
  setDisabled: state => ({ ...state, disabled: true }),
  setEnabled: state => ({ ...state, disabled: false }),
  setHasCancelFileListener: (state, hasListener: boolean) => ({ ...state, hasCancelFileListener: hasListener }),
  renameImage: ({ images, ...state }, { id, data }: ImageActionPayload<string>) => ({
    ...state,
    images: images.map(img =>
      img.id === id ? { ...img, label: data || img.label } : img
    )
  }),
  setAction: (state, currentAction: ButtonAction) => ({ ...state, currentAction, disabled: true }),
  resetAction: (state) => ({ ...state, currentAction: 'none', disabled: false }),
  switchLanguage: ({ languageIndex: prevIndex, ...state }) => {
    const languageIndex = (prevIndex + 1) % LANGUAGE_LIST.length;
    const currentLanguage = LANGUAGE_LIST[languageIndex];

    return { ...state, languageIndex, currentLanguage };
  },
};

export const INITIAL_STATE: ReducerState = {
  languageIndex: 0,
  isInit: false,
  imagePolygonizer: new ImagePolygonizer(),
  images: [],
  currentAction: 'none',
  currentImage: null,
  currentLanguage: LANGUAGE_LIST[0],
  disabled: false,
  buttonActions: ['import'],
  hasCancelFileListener: false,
};

export const REDUCER = (state: ReducerState, { type, payload }: ReducerEvent) =>
  REDUCER_ACTIONS[type](state, payload);
