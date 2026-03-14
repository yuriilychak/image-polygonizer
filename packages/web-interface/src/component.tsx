import { ActionMenu } from './action-menu';
import { WorkingArea } from './working-area';
import usePolygonizer from './hooks';

import type { FC } from 'react';

import './component.css';

const App: FC = () => {
    const {
        t,
        images,
        currentImage,
        currentLanguage,
        disabled,
        buttonActions,
        imageLoaderRef,
        projectName,
        projectLoaderRef,
        saveAnchorRef,
        onActionClick,
        onImageAction,
        onSettingChange,
        onImageUpload,
        onProjectUpload,
        onSwitchLanguage,
        onProjectNameChange,
    } = usePolygonizer();

    return (
        <div className="app-container">
            <ActionMenu
                t={t}
                projectName={projectName}
                images={images}
                currentImage={currentImage}
                currentLanguage={currentLanguage}
                onSwitchLanguage={onSwitchLanguage}
                disabled={disabled}
                buttonActions={buttonActions}
                onActionClick={onActionClick}
                onImageAction={onImageAction}
                onSettingChange={onSettingChange}
                onImageUpload={onImageUpload}
                onProjectUpload={onProjectUpload}
                onProjectNameChange={onProjectNameChange}
                imageLoaderRef={imageLoaderRef}
                projectLoaderRef={projectLoaderRef}
                saveAnchorRef={saveAnchorRef}
            />
            <WorkingArea src={currentImage?.src} polygonInfo={currentImage?.polygonInfo} />
        </div>
    );
};

export default App;
