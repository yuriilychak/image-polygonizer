import type { LanguageKey, SupportedImageFormats } from './types';

export const LANGUAGE_LIST: LanguageKey[] = ['en', 'de', 'es', 'fr', 'pl', 'ru', 'ua'];

const IMAGE_FORMATS: SupportedImageFormats[] = ['png', 'webp'];

export const IMAGE_INPUT_ACCEPT = IMAGE_FORMATS.reduce((acc, format) => `${acc},image/${format},.${format}`, '');

export const NOOP = (): void => {};
