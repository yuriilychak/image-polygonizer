import { useCallback, memo } from 'react';
import { ID_TO_CHAR } from '../constants';

import type { MouseEventHandler } from 'react';
import type { TFunction } from 'i18next';

import './component.css';

type ActionButtonProps<T extends string> = {
    t: TFunction;
    imageId?: string;
    action: T;
    disabled: boolean;
    onAction(action: T, imageId: string): void;
};

function ActionButton<T extends string>({
    t,
    action,
    onAction,
    disabled,
    imageId = '',
}: ActionButtonProps<T>) {
    const handleClick: MouseEventHandler<HTMLButtonElement> = useCallback(
        e => {
            e.stopPropagation();
            onAction(action, imageId);
        },
        [action, imageId, onAction]
    );

    return (
        <button
            className="char-button"
            title={t(`menu_action_title_${action}`)}
            onClick={handleClick}
            disabled={disabled}
        >
            {ID_TO_CHAR[action]}
        </button>
    );
}

export default memo(ActionButton);
