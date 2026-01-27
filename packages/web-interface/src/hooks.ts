import { useRef, useReducer, useEffect, useCallback, ChangeEventHandler, MouseEventHandler } from 'react';
import { useTranslation } from 'react-i18next';
import { INITIAL_STATE, REDUCER } from './reducer';
import { filesToImageMetadataList } from './helpers';

import type { ButtonActionCallback, ImageActionCallback, ImageMetadata, SettingChangeCallback } from './types';

export default function usePolygonizer() {
    const { t, i18n } = useTranslation();
    const [state, dispatch] = useReducer(REDUCER, INITIAL_STATE);
        const imageLoaderRef = useRef<HTMLInputElement>(null);
        const {
            isInit,
            images,
            currentImage,
            currentAction,
            currentLanguage,
            imagePolygonizer,
            disabled,
            buttonActions,
            hasCancelFileListener,
        } = state;
    
        const onActionClick: ButtonActionCallback = useCallback(
            action => dispatch({ type: 'setAction', payload: action }),
            []
        );
    
        const onSettingChange: SettingChangeCallback = useCallback(
            (id, value) => dispatch({ type: 'updateImageConfig', payload: { id, value } }),
            []
        );
    
        const onCancelFileUpload = useCallback(() => dispatch({ type: 'setEnabled' }), []);
    
        const onImageAction: ImageActionCallback = useCallback(
            (type, id, data) => {
                if (type !== 'addImages') {
                    dispatch({ type, payload: { id, data } });
                    return;
                }
    
                if (imageLoaderRef.current === null) {
                    return;
                }
    
                if (!hasCancelFileListener) {
                    imageLoaderRef.current.addEventListener('cancel', onCancelFileUpload);
                    dispatch({ type: 'setHasCancelFileListener', payload: true });
                }
    
                imageLoaderRef.current.click();
    
                dispatch({ type: 'setDisabled' });
            },
            [onCancelFileUpload, hasCancelFileListener]
        );
    
        const onImageUpload: ChangeEventHandler<HTMLInputElement> = useCallback(async ({ target }) => {
            const files = target.files;
    
            if (!files) {
                dispatch({ type: 'setEnabled' });
                return;
            }
    
            const result: ImageMetadata[] = await filesToImageMetadataList(files);
    
            if (result.length > 0) {
                dispatch({ type: 'addImages', payload: result });
            }
    
            target.value = '';
        }, []);

        const onSwitchLanguage: MouseEventHandler = useCallback(() => dispatch({ type: 'switchLanguage' }), []);
    
        useEffect(() => {
            if (!isInit || currentAction === 'none') {
                return;
            }
    
            switch (currentAction) {
                case 'generate':
                    break;
                case 'import':
                    break;
                case 'export':
                    break;
                case 'save':
                    break;
                default:  
            }
        }, [isInit, currentAction, imagePolygonizer]);
    
        useEffect(() => {
            dispatch({ type: 'init' });
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
            images,
            imageLoaderRef,
            currentImage,
            currentLanguage,
            disabled,
            buttonActions,
            onActionClick,
            onSettingChange,
            onImageAction,
            onImageUpload,
            onSwitchLanguage,
        };
}