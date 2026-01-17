import { useCallback } from 'react';
import { ActionMenu } from './action-menu';
import { WorkingArea } from './working-area';
import { ButtonAction, ButtonActionCallback, ImageActionCallback, ImageData, SettingChangeCallback } from './types';
import './App.css';

/**
 * Main application component for the Image Polygonizer
 * @returns The main App component
 */
const App = () => {
  const images: ImageData[] = new Array(5).fill(null).map((_, index) => ({
    id: `image-${index + 1}`,
    label: `Image ${index + 1}`,
    config: {
      maxPointCount: 32,
      alphaThreshold: 0,
      minimalDistance: 8,
    },
  }));
  const buttonActions: ButtonAction[] = ['generate', 'import', 'export', 'save'];

  const onActionClick: ButtonActionCallback = useCallback((action) => {
    console.log(`Action clicked: ${action}`);
  }, []);

  const onSettingChange: SettingChangeCallback = useCallback((id, value) => {
    console.log(`Setting changed: ${id} = ${value}`);
  }, []);

  const onImageAction: ImageActionCallback = useCallback((action, id) => {
    console.log(`Image action: ${action} on image ${id}`);
  }, []);

  return (
    <div className="app-container">
      <ActionMenu
        images={images}
        currentImage={images[0]}
        disabled={false}
        buttonActions={buttonActions}
        onActionClick={onActionClick}
        onImageAction={onImageAction}
        onSettingChange={onSettingChange}
      />
      <WorkingArea />
    </div>
  );
};

export default App;
