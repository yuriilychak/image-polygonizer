import { memo } from 'react';
import { NOOP } from 'image-polygonizer';
import { ActionButton } from '../action-button';

import type { FC, ReactNode } from 'react';
import type { TFunction } from 'i18next';
import type { ReducerAction, ImageActionCallback } from '../../../types';

import './component.css';

type MenuSectionProps = {
    t: TFunction;
    titleKey: string;
    children: ReactNode;
    className?: string;
    contentClassName?: string;
    actions?: ReducerAction[];
    onAction?: ImageActionCallback;
    disabled?: boolean;
};

const MenuSection: FC<MenuSectionProps> = ({
    t,
    titleKey,
    children,
    disabled = false,
    className = '',
    contentClassName = '',
    actions = [],
    onAction = NOOP,
}) => (
    <div className={`menu-section-root ${className}`}>
        <div className="menu-section-header">
            <span className="menu-section-title">{t(titleKey)}</span>
            <div>
                {actions.map(action => (
                    <ActionButton
                        t={t}
                        action={action}
                        key={action}
                        onAction={onAction}
                        disabled={disabled}
                    />
                ))}
            </div>
        </div>
        <div className={`menu-section-content ${contentClassName}`}>{children}</div>
        <div className="menu-section-divider" />
    </div>
);

export default memo(MenuSection);
