import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImageActionCallback, ReducerAction } from '../../../types';

import type { ChangeEventHandler, MouseEventHandler } from 'react';

export default function useImageItem(
    outdated: boolean,
    hasPolygons: boolean,
    label: string,
    disabled: boolean,
    id: string,
    onAction: ImageActionCallback
) {
    const [localName, setLocalName] = useState('');
    const nameRef = useRef<string>(localName);
    const [renameMode, setRenameMode] = useState(false);
    const actions = useMemo(
        () => (renameMode ? ['renameImage', 'closeEditMode'] : ['openEditMode', 'removeImage']),
        [renameMode]
    );
    const warnings = useMemo(() => {
        const result: string[] = [];
        
        if (outdated) {
            result.push('polygonsOutdated');
        }

        if (!hasPolygons) {
            result.push('polygonsMissing');
        }

        return result;
    }, [outdated, hasPolygons]);

    const isLocalNameInvalid = localName.trim() === '' || localName === label;

    useEffect(() => {
        setLocalName(label);
        setRenameMode(false);
    }, [label, disabled]);

    useEffect(() => {
        setLocalName(label);
    }, [label, renameMode]);

    const handleButtonAction = useCallback(
        (action: string, imageId: string) => {
            switch (action) {
                case 'openEditMode':
                    setRenameMode(true);
                    break;
                case 'closeEditMode':
                    setRenameMode(false);
                    break;
                case 'renameImage':
                    onAction(action as ReducerAction, imageId, nameRef.current);
                    setRenameMode(false);
                    break;
                default:
                    onAction(action as ReducerAction, imageId);
            }
        },
        [onAction]
    );

    const handleAction: MouseEventHandler<HTMLElement> = e => {
        e.stopPropagation();
        onAction(e.currentTarget.id as ReducerAction, id, localName);
    };

    const handleLocalNameChange: ChangeEventHandler<HTMLInputElement> = ({ target }) =>
        setLocalName(target.value);

    return {
        localName,
        renameMode,
        actions,
        warnings,
        isLocalNameInvalid,
        handleButtonAction,
        handleAction,
        handleLocalNameChange,
    };
}
