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
        onActionClick,
        onImageAction,
        onSettingChange,
        onImageUpload,
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
                imageLoaderRef={imageLoaderRef}
            />
            <WorkingArea src={currentImage?.src} />
        </div>
    );
};

export default App;
