import type { LanguageKey, SupportedImageFormats } from './types';

export const LANGUAGE_LIST: LanguageKey[] = ['en', 'de', 'es', 'fr', 'pl', 'ru', 'ua'];

export const PROJECT_EXTENSION = '.ipp';

const IMAGE_FORMATS: SupportedImageFormats[] = ['png', 'webp'];

export const CROP_ALL_ID = 'All';

export const IMAGE_INPUT_ACCEPT = IMAGE_FORMATS.reduce((acc, format) => `${acc},image/${format},.${format}`, '');
