import {
    useRef,
    useReducer,
    useEffect,
    useCallback,
    ChangeEventHandler,
    MouseEventHandler,
} from 'react';
import { useTranslation } from 'react-i18next';
import { INITIAL_STATE, REDUCER, getReducerEvent } from './reducer';
import { loadProject, saveProject, exportProject } from './helpers';
import { PROJECT_EXTENSION } from './constants';

import type { ImageConfig, CropOption } from 'image-polygonizer';
import type {
    ButtonActionCallback,
    ExportAction,
    ImageActionCallback,
    SettingChangeCallback,
} from './types';
import { use } from 'i18next';

export default function usePolygonizer() {
    const { t, i18n } = useTranslation();
    const [state, dispatch] = useReducer(REDUCER, INITIAL_STATE);
    const imageLoaderRef = useRef<HTMLInputElement>(null);
    const projectLoaderRef = useRef<HTMLInputElement>(null);
    const saveAnchorRef = useRef<HTMLAnchorElement>(null);
    const {
        isLowResolution,
        isExportModalOpen,
        isInit,
        images,
        projectName,
        currentImage,
        currentAction,
        currentLanguage,
        imagePolygonizer,
        disabled,
        buttonActions,
        hasCancelFileListener,
        exportConfig,
    } = state;

    const onActionClick: ButtonActionCallback = useCallback(
        action => dispatch(getReducerEvent('setAction', action)),
        []
    );

    const onSettingChange: SettingChangeCallback = useCallback(
        (id, value) => dispatch(getReducerEvent('updateImageConfig', { id, value })),
        []
    );

    const onCancelFileUpload = useCallback(() => dispatch(getReducerEvent('setEnabled')), []);
    const onCancelProjectUpload = useCallback(() => dispatch(getReducerEvent('resetAction')), []);

    const onImageAction: ImageActionCallback = useCallback(
        (type, id, data) => {
            if (type !== 'addImages') {
                dispatch(getReducerEvent(type, { id, data }));
                return;
            }

            if (imageLoaderRef.current === null) {
                return;
            }

            if (!hasCancelFileListener) {
                imageLoaderRef.current.addEventListener('cancel', onCancelFileUpload);
                dispatch(getReducerEvent('setHasCancelFileListener', true));
            }

            imageLoaderRef.current.click();

            dispatch(getReducerEvent('setDisabled'));
        },
        [onCancelFileUpload, hasCancelFileListener]
    );

    const onImageUpload: ChangeEventHandler<HTMLInputElement> = useCallback(
        async ({ target }) => {
            const files = target.files;

            if (!files) {
                dispatch(getReducerEvent('setEnabled'));
                return;
            }

            const result: ImageConfig[] = await imagePolygonizer.importImages(files);

            if (result.length > 0) {
                dispatch(getReducerEvent('addImages', result));
            }

            target.value = '';
        },
        [imagePolygonizer]
    );

    const onProjectUpload: ChangeEventHandler<HTMLInputElement> = useCallback(
        async ({ target }) => {
            const file = target.files?.[0];

            if (!file) {
                dispatch(getReducerEvent('resetAction'));
                return;
            }

            const data = await loadProject(file);
            const result = await imagePolygonizer.deserializeImages(data);
            const payload = {
                images: result,
                projectName: file.name.replace(PROJECT_EXTENSION, ''),
            };

            dispatch(getReducerEvent('importProject', payload));
            target.value = '';
        },
        [imagePolygonizer]
    );

    const onSwitchLanguage: MouseEventHandler = useCallback(
        () => dispatch(getReducerEvent('switchLanguage')),
        []
    );

    const onProjectNameChange = useCallback(
        (newName: string) => dispatch(getReducerEvent('projectNameChange', newName)),
        []
    );

    const onCropChange = useCallback(
        (id: string, data: CropOption) =>
            dispatch(getReducerEvent('setFileCropOption', { id, data })),
        []
    );

    const onExportAction = useCallback((action: ExportAction) => {
        switch (action) {
            case 'exportPolygons':
            case 'exportTriangles':
                dispatch(getReducerEvent('toggleSharedExportConfig', action));
                break;
            case 'cancelExport':
                dispatch(getReducerEvent('closeExportModal'));
                return;
            case 'submitExport': {
                dispatch(getReducerEvent('closeExportModal'));
                const exportableImages = images.filter(
                    img => img.selected && img.hasPolygons && !img.outdated
                );
                imagePolygonizer
                    .exportImages(exportableImages, exportConfig)
                    .then(results => exportProject(results, projectName, saveAnchorRef.current!))
                    .then(() => dispatch(getReducerEvent('loadingFinish')));
                break;
            }
            default:
        }
    }, [images, imagePolygonizer, exportConfig, projectName, saveAnchorRef]);

    useEffect(() => {
        if (!isInit || currentAction === 'none') {
            return;
        }

        switch (currentAction) {
            case 'generate':
                imagePolygonizer
                    .polygonize(images.filter(img => img.selected))
                    .then(outputs => dispatch(getReducerEvent('updatePolygonInfo', outputs)));
                break;
            case 'import':
                if (projectLoaderRef.current) {
                    projectLoaderRef.current.addEventListener('cancel', onCancelProjectUpload, {
                        once: true,
                    });
                    projectLoaderRef.current.click();
                }
                break;
            case 'export':
                dispatch(getReducerEvent('openExportModal'));
                break;
            case 'save':
                imagePolygonizer
                    .serializeImages(images)
                    .then(data => saveProject(projectName, data, saveAnchorRef.current!))
                    .then(() => {
                        dispatch(getReducerEvent('loadingFinish'));
                    });
                break;
            default:
        }
    }, [isInit, currentAction, imagePolygonizer, images, onCancelProjectUpload, projectName]);

    useEffect(() => {
        dispatch(getReducerEvent('init'));

        const listener = () => dispatch(getReducerEvent('setLowResolution', window.innerWidth < 960));

        window.addEventListener('resize', listener);
        
        return () => window.removeEventListener('resize', listener);
    }, []);

    useEffect(() => {
        return () => {
            if (imageLoaderRef.current && hasCancelFileListener) {
                imageLoaderRef.current.removeEventListener('cancel', onCancelFileUpload);
            }
        };
    }, [onCancelFileUpload, hasCancelFileListener]);

    useEffect(() => {
        i18n.changeLanguage(currentLanguage);
    }, [currentLanguage, i18n]);

    return {
        t,
        isLowResolution,
        isExportModalOpen,
        images,
        projectName,
        imageLoaderRef,
        projectLoaderRef,
        saveAnchorRef,
        onProjectUpload,
        currentImage,
        currentLanguage,
        exportConfig,
        disabled,
        buttonActions,
        onActionClick,
        onSettingChange,
        onImageAction,
        onImageUpload,
        onSwitchLanguage,
        onProjectNameChange,
        onExportAction,
        onCropChange,
    };
}
