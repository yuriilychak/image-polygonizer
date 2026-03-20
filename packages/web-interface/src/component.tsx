import { ActionMenu } from './action-menu';
import { WorkingArea } from './working-area';
import { ExportModal } from './export-modal';
import usePolygonizer from './hooks';

import type { FC } from 'react';

import './component.css';

const App: FC = () => {
    const {
        t,
        isExportModalOpen,
        images,
        currentImage,
        currentLanguage,
        disabled,
        buttonActions,
        imageLoaderRef,
        exportConfig,
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
        onExportAction,
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
            <ExportModal
                t={t}
                images={images}
                isOpen={isExportModalOpen}
                onAction={onExportAction}
                exportConfig={exportConfig}
            />
        </div>
    );
};

export default App;
