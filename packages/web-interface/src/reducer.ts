import { ImagePolygonizer } from 'image-polygonizer';
import { getButtonActions } from './helpers';
import { LANGUAGE_LIST } from './constants';

import type { ImageConfig, ImageActionPayload } from 'image-polygonizer';
import type {
    ReducerAction,
    ReducerEvent,
    ReducerMiddleware,
    ReducerState,
    SettingChangePayload,
    ButtonAction,
} from './types';

const REDUCER_ACTIONS: Record<ReducerAction, ReducerMiddleware> = {
    init: state => {
        state.imagePolygonizer.init();

        return { ...state, isInit: true };
    },
    addImages: (state, newImages: ImageConfig[]) => {
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
    toggleSelectAllImages: state => {
        const isAllImagesSelected = state.images.every(img => img.selected);
        const images = state.images.map(img => ({ ...img, selected: !isAllImagesSelected }));
        const buttonActions = getButtonActions(images);

        return { ...state, images, buttonActions };
    },
    setDisabled: state => ({ ...state, disabled: true }),
    setEnabled: state => ({ ...state, disabled: false }),
    setHasCancelFileListener: (state, hasListener: boolean) => ({
        ...state,
        hasCancelFileListener: hasListener,
    }),
    renameImage: ({ images, ...state }, { id, data }: ImageActionPayload<string>) => ({
        ...state,
        images: images.map(img => (img.id === id ? { ...img, label: data || img.label } : img)),
    }),
    setAction: (state, currentAction: ButtonAction) => ({
        ...state,
        currentAction,
        disabled: true,
    }),
    resetAction: state => ({ ...state, currentAction: 'none', disabled: false }),
    switchLanguage: ({ languageIndex: prevIndex, ...state }) => {
        const languageIndex = (prevIndex + 1) % LANGUAGE_LIST.length;
        const currentLanguage = LANGUAGE_LIST[languageIndex];

        return { ...state, languageIndex, currentLanguage };
    },
    updatePolygonInfo: (state, payload: ImageActionPayload<Uint16Array>[]) => {
        const updatedImages = state.images.map(img => {
            const update = payload.find(p => p.id === img.id);

            return update
                ? {
                      ...img,
                      polygonInfo: update.data!,
                      hasPolygons: true,
                      outdated: false,
                  }
                : img;
        });

        const currentImage =
            updatedImages.find(img => state.currentImage && img.id === state.currentImage.id) ||
            null;
        const buttonActions = getButtonActions(updatedImages);

        return {
            ...state,
            images: updatedImages,
            currentImage,
            disabled: false,
            currentAction: 'none',
            buttonActions,
        };
    },
    loadingFinish: state => ({ ...state, disabled: false }),
    importProject: (state, payload: { images: ImageConfig[]; projectName: string }) => {
        const { images } = payload;
        const buttonActions = getButtonActions(images);
        const currentImage = images[0] || null;

        return { ...state, ...payload, currentImage, disabled: false, buttonActions };
    },
    projectNameChange: (state, projectName: string) => ({ ...state, projectName }),
};

export const INITIAL_STATE: ReducerState = {
    projectName: 'New Project',
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

export const getReducerEvent = (type: ReducerAction, payload?: any): ReducerEvent => ({
    type,
    payload,
});
