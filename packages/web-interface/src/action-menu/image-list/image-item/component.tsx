import { FC, MouseEvent, ChangeEvent, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { CharAction, ImageActionCallback } from '../../../types';
import './component.css';

type ImageItemProps = {
  id: string;
  label: string;
  disabled: boolean;
  selected: boolean;
  isCurrent: boolean;
  onAction: ImageActionCallback;
};

const ImageItem: FC<ImageItemProps> = ({ id, label, disabled, selected, isCurrent, onAction }) => {
  const { t } = useTranslation();

  const handleAction = (e: MouseEvent<HTMLElement> | ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onAction(e.currentTarget.id as CharAction, id);
  };

  const currentClassName = isCurrent ? ' image-item-root-current' : '';

  return (
    <button
      className={`image-item-root${currentClassName}`}
      onClick={handleAction}
      id="select"
      disabled={disabled}
    >
      <input
        type="checkbox"
        className="image-item-checkbox"
        id="check"
        onChange={handleAction}
        disabled={disabled}
        checked={selected}
      />
      <div className="image-item-title-wrapper">
        <div className="image-item-title">{label}</div>
      </div>
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
