import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageList } from './image-list';
import { ImageDetails } from './image-details';
import { ActionsSection } from './actions-section';
import {
  ButtonAction,
  ButtonActionCallback,
  ImageActionCallback,
  ImageData,
  SettingChangeCallback,
} from '../types';
import './component.css';

type ActionMenuProps = {
  images: ImageData[];
  currentImage: ImageData;
  buttonActions: ButtonAction[];
  onActionClick: ButtonActionCallback;
  onSettingChange: SettingChangeCallback;
  onImageAction: ImageActionCallback;
  disabled: boolean;
};

const LANGUAGE_LIST = ['en', 'de', 'es', 'fr',  'pl', 'ru', 'ua'];

const ActionMenu: FC<ActionMenuProps> = ({
  currentImage,
  images,
  buttonActions,
  onActionClick,
  onSettingChange,
  onImageAction,
  disabled,
}) => {
  const [languageIndex, setLanguageIndex] = useState(0);
  const { t, i18n } = useTranslation();

  const handleLanguageChange = () => {
    setLanguageIndex(prevIndex => {
      const result = (prevIndex + 1) % LANGUAGE_LIST.length;

      i18n.changeLanguage(LANGUAGE_LIST[result]);

      return result;
    });
  };

  return (
    <div className="action-menu">
      <div className="action-menu-header">
        <span>{t('action_menu_title')}</span>
        <button
          onClick={handleLanguageChange}
          className="action-menu-language-button"
          title={t('button_label_language')}
        >
          {LANGUAGE_LIST[languageIndex]}
        </button>
      </div>
      <ImageList images={images} disabled={disabled} onImageAction={onImageAction} />
      <ImageDetails
        onSettingChange={onSettingChange}
        disabled={disabled}
        imageConfig={currentImage.config}
      />
      <ActionsSection actions={buttonActions} onActionClick={onActionClick} disabled={disabled} />
    </div>
  );
};

export default ActionMenu;
