import { FC, MouseEventHandler, memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MenuSection } from '../menu-section';
import type { ButtonAction, ButtonActionCallback } from '../../types';
import './component.css';

type ActionsSectionProps = {
  actions: ButtonAction[];
  onActionClick: ButtonActionCallback;
  disabled: boolean;
};

const ActionsSection: FC<ActionsSectionProps> = ({ actions, onActionClick, disabled }) => {
  const { t } = useTranslation();

  const handleActionClick: MouseEventHandler<HTMLButtonElement> = useCallback(
    ({ currentTarget }) => onActionClick(currentTarget.id as ButtonAction),
    [onActionClick]
  );

  return (
    <MenuSection title={t('menu_section_label_actions')} contentClassName="action-section-content">
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
