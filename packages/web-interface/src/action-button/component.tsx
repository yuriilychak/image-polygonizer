import { useCallback, memo } from 'react';
import type { MouseEventHandler } from 'react';

type ActionButtonProps<T extends string> = {
    imageId?: string;
    action: T;
    title: string;
    label: string;
    disabled: boolean;
    onAction(action: T, imageId: string): void;
};

function ActionButton<T extends string>({
    action,
    title,
    label,
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
        <button className="char-button" title={title} onClick={handleClick} disabled={disabled}>
            {label}
        </button>
    );
}

export default memo(ActionButton);
