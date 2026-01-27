import { memo } from 'react';
import { MenuSection } from '../menu-section';

import type { FC, MouseEventHandler } from 'react';
import type { TFunction } from 'i18next';
import type { ButtonAction, ButtonActionCallback } from '../../types';

import './component.css';

type ActionsSectionProps = {
    t: TFunction;
    actions: ButtonAction[];
    onActionClick: ButtonActionCallback;
    disabled: boolean;
};

const ActionsSection: FC<ActionsSectionProps> = ({ t, actions, onActionClick, disabled }) => {
    const handleActionClick: MouseEventHandler<HTMLButtonElement> = ({ currentTarget }) =>
        onActionClick(currentTarget.id as ButtonAction);

    return (
        <MenuSection
            t={t}
            titleKey="menu_section_label_actions"
            contentClassName="action-section-content"
        >
            {actions.map(action => (
                <button
                    disabled={disabled}
                    id={action}
                    key={action}
                    className="action-button"
                    onClick={handleActionClick}
                >
                    {t(`action_button_label_${action}`)}
                </button>
            ))}
        </MenuSection>
    );
};

export default memo(ActionsSection);
