import type { ImageSetting, LanguageKey, SupportedImageFormats } from './types';

export const DEFAULT_CONFIG: ImageSetting = {
    maxPointCount: 32,
    alphaThreshold: 0,
    minimalDistance: 8,
};

export const LANGUAGE_LIST: LanguageKey[] = ['en', 'de', 'es', 'fr', 'pl', 'ru', 'ua'];

const IMAGE_FORMATS: SupportedImageFormats[] = ['png', 'webp'];

export const IMAGE_INPUT_ACCEPT = IMAGE_FORMATS.reduce((acc, format) => `${acc},image/${format},.${format}`, '');

export const NOOP = (): void => {};
