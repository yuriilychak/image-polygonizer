import { useState, useEffect } from 'react';
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
import { ProjectName } from './project-name';

type ActionMenuProps = {
    images: ImageConfig[];
    isLowResolution: boolean;
    projectName: string;
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
    onProjectNameChange(newName: string): void;
    onSwitchLanguage: MouseEventHandler;
    disabled: boolean;
    t: TFunction;
};

const ActionMenu: FC<ActionMenuProps> = ({
    t,
    projectName,
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
    onProjectNameChange,
    isLowResolution,
}) => {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    useEffect(() => {
        if (!isLowResolution) {
            setIsDrawerOpen(false);
        }
    }, [isLowResolution]);

    const onOpenDrawer = () => setIsDrawerOpen(true);

    const onCloseDrawer = () => setIsDrawerOpen(false);

    return (
        <div className="action-menu">
            <div className="action-menu-header">
                <svg
                    width="24"
                    height="24"
                    version="1.1"
                    viewBox="0 0 24 24"
                    xmlSpace="preserve"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path d="m0 11 10-11 4 9 10-4-5 18-12 1z" fill="#24529d" />
                    <path d="m17 20 3-11-7 3-4-8-6 7 5 10z" fill="#7a9bd4" />
                </svg>
                <span>{t('action_menu_title')}</span>
                {isLowResolution && (
                    <svg
                        onClick={onOpenDrawer}
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        fill="#ffffff"
                        aria-hidden="true"
                        className="action-menu-low-res-icon"
                    >
                        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM9.5 13.5l2 2.5L14.5 12l4.5 6H5l4.5-6z" />
                    </svg>
                )}
                <a
                    href="https://github.com/yuriilychak/image-polygonizer"
                    target="_blank"
                    rel="noreferrer"
                    className="action-menu-github-link"
                    title="GitHub"
                >
                    <svg
                        viewBox="0 0 16 16"
                        width="20"
                        height="20"
                        fill="#ffffff"
                        aria-hidden="true"
                    >
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                    </svg>
                </a>
                <button
                    onClick={onSwitchLanguage}
                    className="action-menu-language-button"
                    title={t('button_label_language')}
                >
                    {currentLanguage}
                </button>
            </div>
            <ProjectName
                name={projectName}
                t={t}
                disabled={disabled}
                onProjectNameChange={onProjectNameChange}
            />
            <div
                className={`action-menu-image-list-wrapper ${isDrawerOpen || !isLowResolution ? '' : 'action-menu-image-list-wrapper-hidden'}`}
            >
                {isLowResolution && (
                    <div className="action-menu-drawer-header">
                        <div className="action-menu-drawer-title">Image select</div>
                        <button className="char-button" onClick={onCloseDrawer}>
                            ✕
                        </button>
                    </div>
                )}
                <ImageList
                    t={t}
                    images={images}
                    disabled={disabled}
                    onImageAction={onImageAction}
                    currentImageId={currentImage?.id}
                />
            </div>
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
};

export default ActionMenu;
