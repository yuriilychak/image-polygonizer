import { memo } from 'react';

import type { FC, ReactNode, MouseEvent } from 'react';
import type { TFunction } from 'i18next';
import type { CharAction, ImageActionCallback } from '../../types';

import './component.css';

type MenuSectionProps = {
    t: TFunction;
    titleKey: string;
    children: ReactNode;
    className?: string;
    contentClassName?: string;
    actions?: CharAction[];
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
}) => {
    const handleAction = (e: MouseEvent<HTMLButtonElement>) =>
        onAction(e.currentTarget.id as CharAction, '');

    return (
        <div className={`menu-section-root ${className}`}>
            <div className="menu-section-header">
                <span className="menu-section-title">{t(titleKey)}</span>
                <div>
                    {actions.map(action => (
                        <button
                            id={action}
                            key={action}
                            className="char-button"
                            title={t(`menu_action_title_${action}`)}
                            onClick={handleAction}
                            disabled={disabled}
                        >
                            {t(`menu_action_label_${action}`)}
                        </button>
                    ))}
                </div>
            </div>
            <div className={`menu-section-content ${contentClassName}`}>{children}</div>
            <div className="menu-section-divider" />
        </div>
    );
};

export default memo(MenuSection);
