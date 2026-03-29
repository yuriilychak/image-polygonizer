import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted makes these variables available inside the vi.mock factory even
// though vi.mock calls are hoisted to the top of the file by Vitest.
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
    // Use a class so that `new ImagePolygonizer()` works in Vitest 4.
    // Each instance shares the same mock method references from mockPolygonizerInstance.
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

import { REDUCER, INITIAL_STATE, getReducerEvent } from '../reducer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeImage = (overrides: Record<string, unknown> = {}) =>
    ({
        id: 'img-1',
        label: 'Image 1',
        selected: false,
        hasPolygons: false,
        outdated: false,
        src: { close: vi.fn() },
        config: { threshold: 128 },
        polygonInfo: undefined,
        ...overrides,
    }) as any;

const makeState = (overrides: Record<string, unknown> = {}) => ({
    ...INITIAL_STATE,
    ...overrides,
});

// ---------------------------------------------------------------------------
describe('INITIAL_STATE', () => {
    it('has isInit: false', () => {
        expect(INITIAL_STATE.isInit).toBe(false);
    });

    it('has projectName: "New Project"', () => {
        expect(INITIAL_STATE.projectName).toBe('New Project');
    });

    it('has empty images array', () => {
        expect(INITIAL_STATE.images).toEqual([]);
    });

    it('has currentImage: null', () => {
        expect(INITIAL_STATE.currentImage).toBeNull();
    });

    it('has disabled: false', () => {
        expect(INITIAL_STATE.disabled).toBe(false);
    });
});

// ---------------------------------------------------------------------------
describe('REDUCER actions', () => {
    describe('init', () => {
        it('sets isInit to true', () => {
            const state = REDUCER(INITIAL_STATE, getReducerEvent('init'));
            expect(state.isInit).toBe(true);
        });

        it('calls imagePolygonizer.init()', () => {
            REDUCER(INITIAL_STATE, getReducerEvent('init'));
            expect(mockPolygonizerInstance.init).toHaveBeenCalled();
        });
    });

    describe('addImages', () => {
        it('appends images to existing list', () => {
            const img1 = makeImage({ id: 'img-1' });
            const img2 = makeImage({ id: 'img-2' });
            const state = makeState({ images: [img1] });

            const next = REDUCER(state, getReducerEvent('addImages', [img2]));

            expect(next.images).toHaveLength(2);
            expect(next.images[1].id).toBe('img-2');
        });

        it('sets currentImage to the first new image when no image was current', () => {
            const img = makeImage({ id: 'img-new' });
            const state = makeState({ currentImage: null });

            const next = REDUCER(state, getReducerEvent('addImages', [img]));

            expect(next.currentImage?.id).toBe('img-new');
        });

        it('keeps the existing currentImage if one was already set', () => {
            const existing = makeImage({ id: 'img-old' });
            const newImg = makeImage({ id: 'img-new' });
            const state = makeState({ images: [existing], currentImage: existing });

            const next = REDUCER(state, getReducerEvent('addImages', [newImg]));

            expect(next.currentImage?.id).toBe('img-old');
        });

        it('updates buttonActions', () => {
            const img = makeImage({ id: 'img-1', selected: true, hasPolygons: true, outdated: false });
            const state = makeState({ images: [] });

            const next = REDUCER(state, getReducerEvent('addImages', [img]));

            expect(next.buttonActions).toContain('export');
        });

        it('sets disabled to false', () => {
            const img = makeImage();
            const state = makeState({ disabled: true });

            const next = REDUCER(state, getReducerEvent('addImages', [img]));

            expect(next.disabled).toBe(false);
        });
    });

    describe('removeImage', () => {
        it('removes the image with the given id', () => {
            const img = makeImage({ id: 'img-del' });
            const state = makeState({ images: [img], currentImage: null });

            const next = REDUCER(state, getReducerEvent('removeImage', { id: 'img-del' }));

            expect(next.images).toHaveLength(0);
        });

        it('calls close() on the removed image src', () => {
            const closeFn = vi.fn();
            const img = makeImage({ id: 'img-del', src: { close: closeFn } });
            const state = makeState({ images: [img], currentImage: null });

            REDUCER(state, getReducerEvent('removeImage', { id: 'img-del' }));

            expect(closeFn).toHaveBeenCalled();
        });

        it('updates currentImage to null when the current image is removed and list is empty', () => {
            const img = makeImage({ id: 'img-del' });
            const state = makeState({ images: [img], currentImage: img });

            const next = REDUCER(state, getReducerEvent('removeImage', { id: 'img-del' }));

            expect(next.currentImage).toBeNull();
        });

        it('updates currentImage to next image when the current is removed', () => {
            const img1 = makeImage({ id: 'img-1' });
            const img2 = makeImage({ id: 'img-2' });
            const state = makeState({ images: [img1, img2], currentImage: img1 });

            const next = REDUCER(state, getReducerEvent('removeImage', { id: 'img-1' }));

            expect(next.currentImage?.id).toBe('img-2');
        });

        it('keeps currentImage unchanged when a different image is removed', () => {
            const img1 = makeImage({ id: 'img-1' });
            const img2 = makeImage({ id: 'img-2' });
            const state = makeState({ images: [img1, img2], currentImage: img1 });

            const next = REDUCER(state, getReducerEvent('removeImage', { id: 'img-2' }));

            expect(next.currentImage?.id).toBe('img-1');
        });
    });

    describe('updateImageConfig', () => {
        it('updates config for the current image', () => {
            const img = makeImage({ id: 'img-1', config: { threshold: 100 } });
            const state = makeState({ images: [img], currentImage: img });

            const next = REDUCER(
                state,
                getReducerEvent('updateImageConfig', { id: 'threshold', value: 200 }),
            );

            expect(next.currentImage?.config.threshold).toBe(200);
        });

        it('marks the image as outdated when it already has polygons', () => {
            const img = makeImage({ id: 'img-1', hasPolygons: true, outdated: false });
            const state = makeState({ images: [img], currentImage: img });

            const next = REDUCER(
                state,
                getReducerEvent('updateImageConfig', { id: 'threshold', value: 50 }),
            );

            expect(next.currentImage?.outdated).toBe(true);
        });

        it('does not mark as outdated when image has no polygons', () => {
            const img = makeImage({ id: 'img-1', hasPolygons: false, outdated: false });
            const state = makeState({ images: [img], currentImage: img });

            const next = REDUCER(
                state,
                getReducerEvent('updateImageConfig', { id: 'threshold', value: 50 }),
            );

            expect(next.currentImage?.outdated).toBe(false);
        });

        it('returns unchanged state when there is no current image', () => {
            const state = makeState({ currentImage: null });
            const next = REDUCER(
                state,
                getReducerEvent('updateImageConfig', { id: 'threshold', value: 50 }),
            );
            expect(next).toBe(state);
        });
    });

    describe('setCurrentImage', () => {
        it('sets currentImage to the image matching the given id', () => {
            const img1 = makeImage({ id: 'img-1' });
            const img2 = makeImage({ id: 'img-2' });
            const state = makeState({ images: [img1, img2], currentImage: img1 });

            const next = REDUCER(state, getReducerEvent('setCurrentImage', { id: 'img-2' }));

            expect(next.currentImage?.id).toBe('img-2');
        });

        it('sets currentImage to null when no image matches', () => {
            const img = makeImage({ id: 'img-1' });
            const state = makeState({ images: [img], currentImage: img });

            const next = REDUCER(state, getReducerEvent('setCurrentImage', { id: 'nonexistent' }));

            expect(next.currentImage).toBeNull();
        });
    });

    describe('toggleImage', () => {
        it('toggles selected from false to true', () => {
            const img = makeImage({ id: 'img-1', selected: false });
            const state = makeState({ images: [img] });

            const next = REDUCER(state, getReducerEvent('toggleImage', { id: 'img-1' }));

            expect(next.images[0].selected).toBe(true);
        });

        it('toggles selected from true to false', () => {
            const img = makeImage({ id: 'img-1', selected: true });
            const state = makeState({ images: [img] });

            const next = REDUCER(state, getReducerEvent('toggleImage', { id: 'img-1' }));

            expect(next.images[0].selected).toBe(false);
        });

        it('does not affect other images', () => {
            const img1 = makeImage({ id: 'img-1', selected: true });
            const img2 = makeImage({ id: 'img-2', selected: false });
            const state = makeState({ images: [img1, img2] });

            const next = REDUCER(state, getReducerEvent('toggleImage', { id: 'img-1' }));

            expect(next.images[1].selected).toBe(false);
        });
    });

    describe('toggleSelectAllImages', () => {
        it('selects all images when not all are selected', () => {
            const images = [
                makeImage({ id: 'img-1', selected: true }),
                makeImage({ id: 'img-2', selected: false }),
            ];
            const state = makeState({ images });

            const next = REDUCER(state, getReducerEvent('toggleSelectAllImages'));

            expect(next.images.every(i => i.selected)).toBe(true);
        });

        it('deselects all images when all are already selected', () => {
            const images = [
                makeImage({ id: 'img-1', selected: true }),
                makeImage({ id: 'img-2', selected: true }),
            ];
            const state = makeState({ images });

            const next = REDUCER(state, getReducerEvent('toggleSelectAllImages'));

            expect(next.images.every(i => !i.selected)).toBe(true);
        });
    });

    describe('setDisabled / setEnabled', () => {
        it('setDisabled sets disabled to true', () => {
            const state = makeState({ disabled: false });
            const next = REDUCER(state, getReducerEvent('setDisabled'));
            expect(next.disabled).toBe(true);
        });

        it('setEnabled sets disabled to false', () => {
            const state = makeState({ disabled: true });
            const next = REDUCER(state, getReducerEvent('setEnabled'));
            expect(next.disabled).toBe(false);
        });
    });

    describe('setHasCancelFileListener', () => {
        it('sets hasCancelFileListener to the provided value', () => {
            const state = makeState({ hasCancelFileListener: false });
            const next = REDUCER(state, getReducerEvent('setHasCancelFileListener', true));
            expect(next.hasCancelFileListener).toBe(true);
        });
    });

    describe('renameImage', () => {
        it('updates label for the matching image', () => {
            const img = makeImage({ id: 'img-1', label: 'Old' });
            const state = makeState({ images: [img] });

            const next = REDUCER(
                state,
                getReducerEvent('renameImage', { id: 'img-1', data: 'New Name' }),
            );

            expect(next.images[0].label).toBe('New Name');
        });

        it('does not rename an image with a different id', () => {
            const img = makeImage({ id: 'img-2', label: 'Original' });
            const state = makeState({ images: [img] });

            const next = REDUCER(
                state,
                getReducerEvent('renameImage', { id: 'img-1', data: 'New' }),
            );

            expect(next.images[0].label).toBe('Original');
        });
    });

    describe('setAction', () => {
        it('sets currentAction and disabled to true', () => {
            const state = makeState({ currentAction: 'none', disabled: false });

            const next = REDUCER(state, getReducerEvent('setAction', 'generate'));

            expect(next.currentAction).toBe('generate');
            expect(next.disabled).toBe(true);
        });
    });

    describe('resetAction', () => {
        it('resets currentAction to none and disabled to false', () => {
            const state = makeState({ currentAction: 'generate', disabled: true });

            const next = REDUCER(state, getReducerEvent('resetAction'));

            expect(next.currentAction).toBe('none');
            expect(next.disabled).toBe(false);
        });
    });

    describe('switchLanguage', () => {
        it('advances to the next language', () => {
            const state = makeState({ languageIndex: 0, currentLanguage: 'en' });

            const next = REDUCER(state, getReducerEvent('switchLanguage'));

            expect(next.languageIndex).toBe(1);
            expect(next.currentLanguage).toBe('de');
        });

        it('wraps around to the first language after the last', () => {
            const state = makeState({ languageIndex: 6, currentLanguage: 'ua' });

            const next = REDUCER(state, getReducerEvent('switchLanguage'));

            expect(next.languageIndex).toBe(0);
            expect(next.currentLanguage).toBe('en');
        });
    });

    describe('updatePolygonInfo', () => {
        it('updates polygonInfo and sets hasPolygons:true, outdated:false for matching images', () => {
            const img = makeImage({ id: 'img-1', hasPolygons: false, outdated: true });
            const state = makeState({ images: [img], currentImage: img, disabled: true });
            const polygonData = new Uint16Array([1, 2, 3]);

            const next = REDUCER(
                state,
                getReducerEvent('updatePolygonInfo', [{ id: 'img-1', data: polygonData }]),
            );

            expect(next.images[0].hasPolygons).toBe(true);
            expect(next.images[0].outdated).toBe(false);
            expect(next.images[0].polygonInfo).toEqual(polygonData);
        });

        it('sets disabled:false and currentAction:none', () => {
            const state = makeState({ disabled: true, currentAction: 'generate' });

            const next = REDUCER(state, getReducerEvent('updatePolygonInfo', []));

            expect(next.disabled).toBe(false);
            expect(next.currentAction).toBe('none');
        });
    });

    describe('loadingFinish', () => {
        it('sets disabled to false', () => {
            const state = makeState({ disabled: true });
            const next = REDUCER(state, getReducerEvent('loadingFinish'));
            expect(next.disabled).toBe(false);
        });
    });

    describe('importProject', () => {
        it('replaces images and projectName, resets currentImage to first image', () => {
            const img = makeImage({ id: 'imported-1' });
            const state = makeState({ images: [], currentImage: null });

            const next = REDUCER(
                state,
                getReducerEvent('importProject', { images: [img], projectName: 'Imported' }),
            );

            expect(next.images).toHaveLength(1);
            expect(next.projectName).toBe('Imported');
            expect(next.currentImage?.id).toBe('imported-1');
        });

        it('sets currentImage to null when imported images list is empty', () => {
            const state = makeState({ images: [], currentImage: null });

            const next = REDUCER(
                state,
                getReducerEvent('importProject', { images: [], projectName: 'Empty' }),
            );

            expect(next.currentImage).toBeNull();
        });
    });

    describe('projectNameChange', () => {
        it('updates projectName', () => {
            const state = makeState({ projectName: 'Old' });
            const next = REDUCER(state, getReducerEvent('projectNameChange', 'New Project Name'));
            expect(next.projectName).toBe('New Project Name');
        });
    });

    describe('openExportModal', () => {
        it('sets isExportModalOpen to true and disabled to true', () => {
            const state = makeState({ isExportModalOpen: false, disabled: false });

            const next = REDUCER(state, getReducerEvent('openExportModal'));

            expect(next.isExportModalOpen).toBe(true);
            expect(next.disabled).toBe(true);
        });

        it('initialises fileConfig with none for each image', () => {
            const img = makeImage({ id: 'img-1' });
            const state = makeState({ images: [img] });

            const next = REDUCER(state, getReducerEvent('openExportModal'));

            expect(next.exportConfig.fileConfig['img-1']).toBe('none');
        });

        it('initialises shared export options with both flags true', () => {
            const state = makeState({});

            const next = REDUCER(state, getReducerEvent('openExportModal'));

            expect(next.exportConfig.shared.exportPolygons).toBe(true);
            expect(next.exportConfig.shared.exportTriangles).toBe(true);
        });
    });

    describe('closeExportModal', () => {
        it('sets isExportModalOpen to false and disabled to false', () => {
            const state = makeState({ isExportModalOpen: true, disabled: true });

            const next = REDUCER(state, getReducerEvent('closeExportModal'));

            expect(next.isExportModalOpen).toBe(false);
            expect(next.disabled).toBe(false);
        });

        it('resets currentAction to none', () => {
            const state = makeState({ currentAction: 'export' });

            const next = REDUCER(state, getReducerEvent('closeExportModal'));

            expect(next.currentAction).toBe('none');
        });
    });

    describe('toggleSharedExportConfig', () => {
        it('toggles exportPolygons from true to false', () => {
            const state = makeState({
                exportConfig: {
                    shared: { exportPolygons: true, exportTriangles: true },
                    fileConfig: {},
                },
            });

            const next = REDUCER(state, getReducerEvent('toggleSharedExportConfig', 'exportPolygons'));

            expect(next.exportConfig.shared.exportPolygons).toBe(false);
        });

        it('toggles exportTriangles from false to true', () => {
            const state = makeState({
                exportConfig: {
                    shared: { exportPolygons: true, exportTriangles: false },
                    fileConfig: {},
                },
            });

            const next = REDUCER(
                state,
                getReducerEvent('toggleSharedExportConfig', 'exportTriangles'),
            );

            expect(next.exportConfig.shared.exportTriangles).toBe(true);
        });
    });

    describe('setFileCropOption', () => {
        it('sets crop option for a specific image', () => {
            const img = makeImage({ id: 'img-1' });
            const state = makeState({
                images: [img],
                exportConfig: { shared: { exportPolygons: true, exportTriangles: true }, fileConfig: {} },
            });

            const next = REDUCER(
                state,
                getReducerEvent('setFileCropOption', { id: 'img-1', data: 'tight' }),
            );

            expect(next.exportConfig.fileConfig['img-1']).toBe('tight');
        });

        it('sets crop option for all images when id is CROP_ALL_ID', () => {
            const img1 = makeImage({ id: 'img-1' });
            const img2 = makeImage({ id: 'img-2' });
            const state = makeState({
                images: [img1, img2],
                exportConfig: { shared: { exportPolygons: true, exportTriangles: true }, fileConfig: {} },
            });

            const next = REDUCER(
                state,
                getReducerEvent('setFileCropOption', { id: 'All', data: 'tight' }),
            );

            expect(next.exportConfig.fileConfig['img-1']).toBe('tight');
            expect(next.exportConfig.fileConfig['img-2']).toBe('tight');
        });
    });

    describe('setLowResolution', () => {
        it('sets isLowResolution to true', () => {
            const state = makeState({ isLowResolution: false });
            const next = REDUCER(state, getReducerEvent('setLowResolution', true));
            expect(next.isLowResolution).toBe(true);
        });

        it('sets isLowResolution to false', () => {
            const state = makeState({ isLowResolution: true });
            const next = REDUCER(state, getReducerEvent('setLowResolution', false));
            expect(next.isLowResolution).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
describe('getReducerEvent', () => {
    it('returns an event object with the given type and payload', () => {
        const event = getReducerEvent('addImages', []);
        expect(event.type).toBe('addImages');
        expect(event.payload).toEqual([]);
    });

    it('returns an event object with undefined payload when not provided', () => {
        const event = getReducerEvent('resetAction');
        expect(event.type).toBe('resetAction');
        expect(event.payload).toBeUndefined();
    });
});
