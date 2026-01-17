import { FC, MouseEvent, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { CharAction, ImageActionCallback } from '../../../types';
import './component.css';

type ImageItemProps = {
    id: string;
    label: string;
    disabled: boolean;
    onAction: ImageActionCallback;
};

const ImageItem: FC<ImageItemProps> = ({ id, label, disabled, onAction }) => {
  const { t } = useTranslation();

  const handleAction = (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    onAction(e.currentTarget.id as CharAction, id);
  };

  return (
    <button className="image-item-root" onClick={handleAction} id="select" disabled={disabled}>
      <input type="checkbox" className="image-item-checkbox" id="check" onClick={handleAction} disabled={disabled} />
      <span className="image-item-title">{label}</span>
      <button
        id="remove"
        disabled={disabled}
        className="char-button image-item-remove-button"
        title={t('menu_action_title_remove')}
        onClick={handleAction}
      >
        {t('menu_action_label_remove')}
      </button>
    </button>
  );
};

export default memo(ImageItem);
