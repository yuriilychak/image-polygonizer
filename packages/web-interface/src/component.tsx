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
        projectLoaderRef,
        saveAnchorRef,
        onActionClick,
        onImageAction,
        onSettingChange,
        onImageUpload,
        onProjectUpload,
        onSwitchLanguage,
    } = usePolygonizer();

    return (
        <div className="app-container">
            <ActionMenu
                t={t}
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
                imageLoaderRef={imageLoaderRef}
                projectLoaderRef={projectLoaderRef}
                saveAnchorRef={saveAnchorRef}
            />
            <WorkingArea src={currentImage?.src} polygonInfo={currentImage?.polygonInfo} />
        </div>
    );
};

export default App;
