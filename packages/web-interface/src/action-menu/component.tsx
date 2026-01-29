import { ImageList } from './image-list';
import { ImageDetails } from './image-details';
import { ActionsSection } from './actions-section';
import { IMAGE_INPUT_ACCEPT } from '../constants';

import type { FC, ChangeEventHandler, MouseEventHandler, RefObject } from 'react';
import type { TFunction } from 'i18next';
import type { ImageConfig } from 'image-polygonizer';
import type {
    ButtonAction,
    ButtonActionCallback,
    ImageActionCallback,
    LanguageKey,
    SettingChangeCallback,
} from '../types';

import './component.css';

type ActionMenuProps = {
    images: ImageConfig[];
    currentLanguage: LanguageKey;
    currentImage: ImageConfig | null;
    imageLoaderRef: RefObject<HTMLInputElement>;
    buttonActions: ButtonAction[];
    onActionClick: ButtonActionCallback;
    onSettingChange: SettingChangeCallback;
    onImageAction: ImageActionCallback;
    onImageUpload: ChangeEventHandler<HTMLInputElement>;
    onSwitchLanguage: MouseEventHandler;
    disabled: boolean;
    t: TFunction;
};

const ActionMenu: FC<ActionMenuProps> = ({
    t,
    currentImage,
    currentLanguage,
    disabled,
    imageLoaderRef,
    images,
    buttonActions,
    onActionClick,
    onSettingChange,
    onImageAction,
    onImageUpload,
    onSwitchLanguage,
}) => (
    <div className="action-menu">
        <div className="action-menu-header">
            <span>{t('action_menu_title')}</span>
            <button
                onClick={onSwitchLanguage}
                className="action-menu-language-button"
                title={t('button_label_language')}
            >
                {currentLanguage}
            </button>
        </div>
        <ImageList
            t={t}
            images={images}
            disabled={disabled}
            onImageAction={onImageAction}
            currentImageId={currentImage?.id}
        />
        {currentImage && (
            <ImageDetails
                t={t}
                onSettingChange={onSettingChange}
                disabled={disabled}
                imageConfig={currentImage.config}
            />
        )}
        <ActionsSection
            t={t}
            actions={buttonActions}
            onActionClick={onActionClick}
            disabled={disabled}
        />
        <input
            id="image-upload-input"
            type="file"
            accept={IMAGE_INPUT_ACCEPT}
            multiple
            className="action-menu-image-loader"
            onChange={onImageUpload}
            ref={imageLoaderRef}
        />
    </div>
);

export default ActionMenu;
