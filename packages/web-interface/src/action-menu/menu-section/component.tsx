import { memo } from 'react';

import type { FC, ReactNode, MouseEvent } from 'react';
import type { TFunction } from 'i18next';
import type { ReducerAction, ImageActionCallback } from '../../types';

import './component.css';
import { ActionButton } from '../../action-button';

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
    onAction = () => {},
}) => (
    <div className={`menu-section-root ${className}`}>
        <div className="menu-section-header">
            <span className="menu-section-title">{t(titleKey)}</span>
            <div>
                {actions.map(action => (
                    <ActionButton
                        action={action}
                        key={action}
                        title={t(`menu_action_title_${action}`)}
                        onAction={onAction}
                        disabled={disabled}
                        label={t(`menu_action_label_${action}`)}
                    />
                ))}
            </div>
        </div>
        <div className={`menu-section-content ${contentClassName}`}>{children}</div>
        <div className="menu-section-divider" />
    </div>
);

export default memo(MenuSection);
