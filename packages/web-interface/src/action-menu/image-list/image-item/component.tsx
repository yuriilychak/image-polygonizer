import { FC, MouseEventHandler, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageActionCallback, ReducerAction } from '../../../types';
import './component.css';

type ImageItemProps = {
  id: string;
  label: string;
  disabled: boolean;
  selected: boolean;
  outdated: boolean;
  hasPolygons: boolean;
  isCurrent: boolean;
  onAction: ImageActionCallback;
};

function getRootStyles(isCurrent: boolean, disabled: boolean): string {
  const result = ['image-item-root'];

  if (isCurrent) {
    result.push('image-item-root-current');
  }

  if (disabled) {
    result.push('image-item-root-disabled');
  }

  return result.join(' ');
}

const ImageItem: FC<ImageItemProps> = ({
  id,
  label,
  disabled,
  selected,
  outdated,
  hasPolygons,
  isCurrent,
  onAction,
}) => {
  const { t } = useTranslation();

  const handleAction: MouseEventHandler<HTMLElement> = e => {
    onAction(e.currentTarget.id as ReducerAction, id);
    e.stopPropagation();
  };

  const rootStyles = getRootStyles(isCurrent, disabled);

  return (
    <div
      className={rootStyles}
      onClick={handleAction}
      id="setCurrentImage"
    >
      <input
        type="checkbox"
        className="image-item-checkbox"
        id="toggleImage"
        onClick={handleAction}
        disabled={disabled}
        checked={selected}
      />
      <div className="image-item-title-wrapper">
        <div className="image-item-title">{label}</div>
      </div>
      {outdated && (
        <div className="help-icon" title={t('menu_action_title_outdated_polygons')}>
          ﹡
        </div>
      )}
      {!hasPolygons && (
        <div className="help-icon" title={t('menu_action_title_polygons_missing')}>
          !
        </div>
      )}
      <button
        id="removeImage"
        disabled={disabled}
        className="char-button image-item-remove-button"
        title={t('menu_action_title_remove')}
        onClick={handleAction}
      >
        {t('menu_action_label_remove')}
      </button>
    </div>
  );
};

export default memo(ImageItem);
