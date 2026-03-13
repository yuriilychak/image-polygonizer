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
    projectLoaderRef: RefObject<HTMLInputElement>;
    saveAnchorRef: RefObject<HTMLAnchorElement>;
    buttonActions: ButtonAction[];
    onActionClick: ButtonActionCallback;
    onSettingChange: SettingChangeCallback;
    onImageAction: ImageActionCallback;
    onImageUpload: ChangeEventHandler<HTMLInputElement>;
    onProjectUpload: ChangeEventHandler<HTMLInputElement>;
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
    projectLoaderRef,
    saveAnchorRef,
    images,
    buttonActions,
    onActionClick,
    onSettingChange,
    onImageAction,
    onImageUpload,
    onProjectUpload,
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
        <input
            id="project-upload-input"
            type="file"
            accept=".ipp"
            className="action-menu-image-loader"
            onChange={onProjectUpload}
            ref={projectLoaderRef}
        />
        {/* eslint-disable-next-line jsx-a11y/anchor-has-content */}
        <a ref={saveAnchorRef} className="action-menu-image-loader" />
    </div>
);

export default ActionMenu;
