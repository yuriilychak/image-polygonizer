import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPolygonizerInstance = vi.hoisted(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    importImages: vi.fn().mockResolvedValue([]),
    polygonize: vi.fn().mockResolvedValue([]),
    serializeImages: vi.fn().mockResolvedValue(new Uint8Array(0)),
    deserializeImages: vi.fn().mockResolvedValue([]),
    exportImages: vi.fn().mockResolvedValue([]),
}));

vi.mock('image-polygonizer', () => ({
    PolygonData: {
        getInstance: vi.fn().mockReturnValue({
            hasAlphaMask: vi.fn().mockReturnValue(false),
            hasContours: vi.fn().mockReturnValue(false),
            hasPolygons: vi.fn().mockReturnValue(false),
            hasTriangles: vi.fn().mockReturnValue(false),
            deserializeAlphaMask: vi.fn().mockReturnValue(new Uint8Array(0)),
            deserializeContours: vi.fn().mockReturnValue([]),
            deserializePolygons: vi.fn().mockReturnValue([]),
            deserializeTriangles: vi.fn().mockReturnValue([]),
            deserializeOffset: vi.fn().mockReturnValue(0),
            deserializeOutline: vi.fn().mockReturnValue(0),
        }),
    },
    ImagePolygonizer: class {
        init = mockPolygonizerInstance.init;
        importImages = mockPolygonizerInstance.importImages;
        polygonize = mockPolygonizerInstance.polygonize;
        serializeImages = mockPolygonizerInstance.serializeImages;
        deserializeImages = mockPolygonizerInstance.deserializeImages;
        exportImages = mockPolygonizerInstance.exportImages;
    },
    NOOP: () => {},
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { changeLanguage: vi.fn() },
    }),
}));

vi.mock('i18next', () => ({
    default: { changeLanguage: vi.fn() },
    use: vi.fn().mockReturnThis(),
    init: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../helpers', () => ({
    loadProject: vi.fn().mockResolvedValue(new Uint8Array(0)),
    saveProject: vi.fn().mockResolvedValue(undefined),
    exportProject: vi.fn().mockResolvedValue(undefined),
    getButtonActions: vi.fn().mockReturnValue(['import']),
}));

// ---------------------------------------------------------------------------

import usePolygonizer from '../hooks';

// ---------------------------------------------------------------------------
describe('usePolygonizer hook', () => {
    describe('returned shape', () => {
        it('returns all expected callback properties', () => {
            const { result } = renderHook(() => usePolygonizer());

            expect(typeof result.current.onActionClick).toBe('function');
            expect(typeof result.current.onSettingChange).toBe('function');
            expect(typeof result.current.onImageAction).toBe('function');
            expect(typeof result.current.onImageUpload).toBe('function');
            expect(typeof result.current.onProjectUpload).toBe('function');
            expect(typeof result.current.onSwitchLanguage).toBe('function');
            expect(typeof result.current.onProjectNameChange).toBe('function');
            expect(typeof result.current.onExportAction).toBe('function');
            expect(typeof result.current.onCropChange).toBe('function');
        });

        it('returns all expected ref properties', () => {
            const { result } = renderHook(() => usePolygonizer());

            expect(result.current.imageLoaderRef).toBeDefined();
            expect(result.current.projectLoaderRef).toBeDefined();
            expect(result.current.saveAnchorRef).toBeDefined();
        });

        it('returns expected initial state values', () => {
            const { result } = renderHook(() => usePolygonizer());

            expect(result.current.images).toEqual([]);
            expect(result.current.currentImage).toBeNull();
            expect(result.current.projectName).toBe('New Project');
            expect(result.current.disabled).toBe(false);
        });

        it('exposes the translation helper', () => {
            const { result } = renderHook(() => usePolygonizer());
            expect(typeof result.current.t).toBe('function');
            expect(result.current.t('hello')).toBe('hello');
        });
    });

    describe('onProjectNameChange', () => {
        it('updates projectName in state', () => {
            const { result } = renderHook(() => usePolygonizer());

            act(() => {
                result.current.onProjectNameChange('My New Project');
            });

            expect(result.current.projectName).toBe('My New Project');
        });
    });

    describe('onSwitchLanguage', () => {
        it('advances currentLanguage to the next in the list', () => {
            const { result } = renderHook(() => usePolygonizer());
            const initial = result.current.currentLanguage;

            act(() => {
                result.current.onSwitchLanguage({} as React.MouseEvent);
            });

            expect(result.current.currentLanguage).not.toBe(initial);
        });
    });

    describe('onCropChange', () => {
        it('updates exportConfig.fileConfig for the given image id', () => {
            const { result } = renderHook(() => usePolygonizer());

            act(() => {
                result.current.onCropChange('img-abc', 'tight' as any);
            });

            expect(result.current.exportConfig.fileConfig['img-abc']).toBe('tight');
        });
    });

    describe('onExportAction', () => {
        it('"cancelExport" closes the export modal (isExportModalOpen stays false)', () => {
            const { result } = renderHook(() => usePolygonizer());

            act(() => {
                result.current.onExportAction('cancelExport');
            });

            expect(result.current.isExportModalOpen).toBe(false);
        });

        it('"exportPolygons" toggles shared.exportPolygons', () => {
            const { result } = renderHook(() => usePolygonizer());
            const before = result.current.exportConfig.shared.exportPolygons;

            act(() => {
                result.current.onExportAction('exportPolygons');
            });

            expect(result.current.exportConfig.shared.exportPolygons).toBe(!before);
        });

        it('"exportTriangles" toggles shared.exportTriangles', () => {
            const { result } = renderHook(() => usePolygonizer());
            const before = result.current.exportConfig.shared.exportTriangles;

            act(() => {
                result.current.onExportAction('exportTriangles');
            });

            expect(result.current.exportConfig.shared.exportTriangles).toBe(!before);
        });
    });

    describe('onImageAction', () => {
        it('dispatches removeImage for a non-addImages action', () => {
            const { result } = renderHook(() => usePolygonizer());

            // Dispatching removeImage on a non-existent id should not crash and
            // images list should remain empty.
            act(() => {
                result.current.onImageAction('removeImage', 'ghost-id');
            });

            expect(result.current.images).toHaveLength(0);
        });

        it('dispatches setCurrentImage without crashing', () => {
            const { result } = renderHook(() => usePolygonizer());

            act(() => {
                result.current.onImageAction('setCurrentImage', 'no-match');
            });

            expect(result.current.currentImage).toBeNull();
        });
    });

    describe('onSettingChange', () => {
        it('does not throw when called without a current image', () => {
            const { result } = renderHook(() => usePolygonizer());

            expect(() => {
                act(() => {
                    result.current.onSettingChange('threshold' as any, 42);
                });
            }).not.toThrow();
        });
    });

    describe('after mount', () => {
        it('calls imagePolygonizer.init()', () => {
            renderHook(() => usePolygonizer());
            expect(mockPolygonizerInstance.init).toHaveBeenCalled();
        });
    });
});
