import { FC, useState, ChangeEventHandler, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageList } from './image-list';
import { ImageDetails } from './image-details';
import { ActionsSection } from './actions-section';
import {
  ButtonAction,
  ButtonActionCallback,
  ImageActionCallback,
  ImageConfig,
  SettingChangeCallback,
} from '../types';
import './component.css';

type ActionMenuProps = {
  images: ImageConfig[];
  currentImage: ImageConfig | null;
  imageLoaderRef: RefObject<HTMLInputElement>;
  buttonActions: ButtonAction[];
  onActionClick: ButtonActionCallback;
  onSettingChange: SettingChangeCallback;
  onImageAction: ImageActionCallback;
  onImageUpload: ChangeEventHandler<HTMLInputElement>;
  disabled: boolean;
};

const LANGUAGE_LIST = ['en', 'de', 'es', 'fr', 'pl', 'ru', 'ua'];

const ActionMenu: FC<ActionMenuProps> = ({
  currentImage,
  images,
  buttonActions,
  onActionClick,
  onSettingChange,
  onImageAction,
  onImageUpload,
  disabled,
  imageLoaderRef,
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
      <ImageList
        images={images}
        disabled={disabled}
        onImageAction={onImageAction}
        currentImageId={currentImage ? currentImage.id : ''}
      />
      {currentImage && (
        <ImageDetails
          onSettingChange={onSettingChange}
          disabled={disabled}
          imageConfig={currentImage.config}
        />
      )}
      <ActionsSection actions={buttonActions} onActionClick={onActionClick} disabled={disabled} />
      <input
        id="image-upload-input"
        type="file"
        accept="image/png,image/webp,.png,.webp"
        multiple
        className="action-menu-image-loader"
        onChange={onImageUpload}
        ref={imageLoaderRef}
      />
    </div>
  );
};

export default ActionMenu;
