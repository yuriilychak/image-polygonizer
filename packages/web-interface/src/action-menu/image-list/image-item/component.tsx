import { FC, MouseEventHandler, ChangeEventHandler, memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageActionCallback, ReducerAction } from '../../../types';
import './component.css';

type ImageItemProps = {
  id: string;
  label: string;
  type: string;
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
  type,
  disabled,
  selected,
  outdated,
  hasPolygons,
  isCurrent,
  onAction,
}) => {
  const [localName, setLocalName] = useState('');
  const [renameMode, setRenameMode] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    setLocalName(label);
    setRenameMode(false);
  }, [label, disabled]);

  const handleAction: MouseEventHandler<HTMLElement> = e => {
    const action = e.currentTarget.id;

    switch (action) {
      case 'openEditMode':
        setRenameMode(true);
        break;
      case 'closeEditMode':
        setLocalName(label);
        setRenameMode(false);
        break;
      default:
        onAction(action as ReducerAction, id, localName);
        if (action === 'renameImage') {
          setRenameMode(false);
        }
    }

    e.stopPropagation();
  };

  const rootStyles = getRootStyles(isCurrent, disabled);

  const handleLocalNameChange: ChangeEventHandler<HTMLInputElement> = e =>
    setLocalName(e.target.value);

  return (
    <div className={rootStyles} onClick={handleAction} id="setCurrentImage">
      <input
        type="checkbox"
        className="image-item-checkbox"
        id="toggleImage"
        onClick={handleAction}
        disabled={disabled}
        checked={selected}
      />
      <div className="image-item-type-inicator">{type}</div>
      {renameMode ? (
        <input
          value={localName}
          onChange={handleLocalNameChange}
          className="image-item-rename-input"
        />
      ) : (
        <div className="image-item-title-wrapper">
          <div className="image-item-title">{label}</div>
        </div>
      )}
      {outdated && (
        <div className="warning-icon" title={t('menu_action_title_outdated_polygons')}>
          ﹡
        </div>
      )}
      {!hasPolygons && (
        <div className="warning-icon" title={t('menu_action_title_polygons_missing')}>
          !
        </div>
      )}
      {renameMode ? (
        <>
          <button
            id="renameImage"
            disabled={disabled || localName.trim() === '' || localName === label}
            className="char-button image-item-remove-button"
            title={t('menu_action_title_rename')}
            onClick={handleAction}
          >
            ✓
          </button>
          <button
            id="closeEditMode"
            disabled={disabled}
            className="char-button image-item-remove-button"
            title={t('menu_action_title_close_edit_mode')}
            onClick={handleAction}
          >
            ✕
          </button>
        </>
      ) : (
        <>
          <button
            id="openEditMode"
            disabled={disabled}
            className="char-button image-item-remove-button"
            title={t('menu_action_title_rename')}
            onClick={handleAction}
          >
            ✎
          </button>
          <button
            id="removeImage"
            disabled={disabled}
            className="char-button image-item-remove-button"
            title={t('menu_action_title_remove')}
            onClick={handleAction}
          >
            {t('menu_action_label_remove')}
          </button>
        </>
      )}
    </div>
  );
};

export default memo(ImageItem);
