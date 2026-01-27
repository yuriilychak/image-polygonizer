import { memo, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { FC, MouseEventHandler, ChangeEventHandler } from 'react';
import type { ImageActionCallback, ReducerAction } from '../../../types';

import './component.css';
import { ActionButton } from '../../../action-button';

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

const noopChange: ChangeEventHandler = () => {};

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

  useEffect(() => {
      setLocalName(label);
  }, [label, renameMode]);

  const handleButtonAction = useCallback((action: string, imageId: string) => {
      switch (action) {
          case 'openEditMode':
              setRenameMode(true);
              break;
          case 'closeEditMode':
              setRenameMode(false);
              break;
          case 'renameImage':
              onAction(action as ReducerAction, imageId, localName);
              setRenameMode(false);
              break;
          default:
              onAction(action as ReducerAction, imageId);
      }
  }, [localName, onAction]);

  const handleAction: MouseEventHandler<HTMLElement> = e => {
    e.stopPropagation();
    onAction(e.currentTarget.id as ReducerAction, id, localName);
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
              onChange={noopChange}
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
                  <ActionButton
                      imageId={id}
                      action="renameImage"
                      disabled={disabled || localName.trim() === '' || localName === label}
                      title={t('menu_action_title_rename')}
                      onAction={handleButtonAction}
                      label="✓"
                  />
                  <ActionButton
                      imageId={id}
                      action="closeEditMode"
                      disabled={disabled}
                      title={t('menu_action_title_close_edit_mode')}
                      onAction={handleButtonAction}
                      label="✕"
                  />
              </>
          ) : (
              <>
                  <ActionButton
                      imageId={id}
                      action="openEditMode"
                      disabled={disabled}
                      title={t('menu_action_title_rename')}
                      onAction={handleButtonAction}
                      label="✎"
                  />
                  <ActionButton
                      imageId={id}
                      action="removeImage"
                      disabled={disabled}
                      title={t('menu_action_title_remove')}
                      onAction={handleButtonAction}
                      label="✕"
                  />
              </>
          )}
      </div>
  );
};

export default memo(ImageItem);
