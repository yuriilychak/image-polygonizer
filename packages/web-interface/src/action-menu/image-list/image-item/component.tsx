import { memo, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NOOP } from '../../../constants';
import { ActionButton, WarningIcon } from '../../shared';

import type { FC, MouseEventHandler, ChangeEventHandler } from 'react';
import type { ImageActionCallback, ReducerAction } from '../../../types';

import './component.css';

type ImageItemProps = {
    id: string;
    label: string;
    type: string;
    disabled: boolean;
    selected: boolean;
    outdated: boolean;
    hasPolygons: boolean;
    isCurrent: boolean;
    onAction: ImageActionCallback;
};

const ImageItem: FC<ImageItemProps> = ({
    id,
    label,
    type,
    disabled,
    selected,
    outdated,
    hasPolygons,
    isCurrent,
    onAction,
}) => {
    const [localName, setLocalName] = useState('');
    const nameRef = useRef<string>(localName);
    const [renameMode, setRenameMode] = useState(false);
    const { t } = useTranslation();
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

    const rootStyles = useMemo(() => {
        const result = ['image-item-root'];

        if (isCurrent) {
            result.push('image-item-root-current');
        }

        if (disabled) {
            result.push('image-item-root-disabled');
        }

        return result.join(' ');
    }, [isCurrent, disabled]);

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

    return (
        <div className={rootStyles} onClick={handleAction} id="setCurrentImage">
            <input
                type="checkbox"
                className="image-item-checkbox"
                id="toggleImage"
                onClick={handleAction}
                onChange={NOOP}
                disabled={disabled}
                checked={selected}
            />
            <div className="image-item-type-inicator">{type}</div>
            {renameMode ? (
                <input
                    value={localName}
                    onChange={handleLocalNameChange}
                    className="image-item-rename-input"
                />
            ) : (
                <div className="image-item-title-wrapper">
                    <div className="image-item-title">{label}</div>
                </div>
            )}
            {warnings.map(warning => (
                <WarningIcon key={warning} id={warning} t={t} />
            ))}
            {actions.map(action => (
                <ActionButton
                    t={t}
                    imageId={id}
                    action={action}
                    key={action}
                    disabled={disabled || (action === 'renameImage' && isLocalNameInvalid)}
                    onAction={handleButtonAction}
                />
            ))}
        </div>
    );
};

export default memo(ImageItem);
