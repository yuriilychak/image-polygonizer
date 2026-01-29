import { memo, useMemo } from 'react';
import { NOOP } from '../../../constants';
import { ActionButton, WarningIcon } from '../../shared';
import useImageItem from './hooks';

import type { FC } from 'react';
import type { TFunction } from 'i18next';
import type { ImageActionCallback } from '../../../types';

import './component.css';

type ImageItemProps = {
    t: TFunction;
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
    t,
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
    const {
        localName,
        renameMode,
        actions,
        warnings,
        isLocalNameInvalid,
        handleButtonAction,
        handleAction,
        handleLocalNameChange,
    } = useImageItem(outdated, hasPolygons, label, disabled, id, onAction);
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
