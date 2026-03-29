import { describe, it, expect, vi } from 'vitest';

vi.mock('i18next', () => ({
    default: {
        use: vi.fn().mockReturnThis(),
        init: vi.fn().mockResolvedValue(undefined),
        changeLanguage: vi.fn(),
    },
}));

vi.mock('react-i18next', () => ({
    initReactI18next: {},
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { changeLanguage: vi.fn() },
    }),
}));

vi.mock('i18next-browser-languagedetector', () => ({
    default: {},
}));

// ---------------------------------------------------------------------------
describe('i18n module', () => {
    it('initialises i18next with use/init and correct options when the module loads', async () => {
        // Dynamically import i18n.ts — this triggers its module-level initialisation code
        // (i18n.use(LanguageDetector).use(initReactI18next).init({...})).
        // All assertions must live in this same test because vi.clearAllMocks() runs
        // after each test and would wipe the recorded calls.
        const { default: i18nModule } = await import('../i18n');
        const { default: i18nMock } = await import('i18next');
        const mock = i18nMock as any;

        expect(i18nModule).toBeDefined();
        expect(mock.use).toHaveBeenCalled();
        expect(mock.init).toHaveBeenCalled();

        const initArg = mock.init.mock.calls[0]?.[0];
        expect(initArg?.fallbackLng).toBe('en');
        expect(initArg?.interpolation?.escapeValue).toBe(false);
    });

    it('does not throw when the module is re-imported (cached)', () => {
        expect(() => import('../i18n')).not.toThrow();
    });
});
