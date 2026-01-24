import { useCallback, useReducer, ChangeEvent, useRef } from 'react';
import { ActionMenu } from './action-menu';
import { WorkingArea } from './working-area';
import { ButtonActionCallback, ImageActionCallback, ImageMetadata, SettingChangeCallback } from './types';
import { INITIAL_STATE, REDUCER } from './reducer';
import './App.css';
import { filesToImageMetadataList } from './helpers';


/**
 * Main application component for the Image Polygonizer
 * @returns The main App component
 */
const App = () => {
  const [state, dispatch] = useReducer(REDUCER, INITIAL_STATE);
  const imageLoaderRef = useRef<HTMLInputElement>(null);
  const { images, currentImage, disabled, buttonActions } = state;

  const onActionClick: ButtonActionCallback = useCallback((action) => {
    console.log(`Action clicked: ${action}`);
    dispatch({ type: 'setDisabled' });
  }, []);

  const onSettingChange: SettingChangeCallback = useCallback((id, value) => {
    dispatch({ type: 'updateImageConfig', payload: { id, value } });
  }, []);

  const onImageAction: ImageActionCallback = useCallback((type, payload) => {
    if (type === 'addImages') {
      imageLoaderRef.current?.click();
    } else {
      dispatch({ type, payload });
    }
  }, []);

  const onImageUpload = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;

    if (!files) {
      return;
    }

    dispatch({ type: 'setDisabled' });

    const result: ImageMetadata[] = await filesToImageMetadataList(files);
    
    if (result.length > 0) {
      dispatch({ type: 'addImages', payload: result });
    }
      
    (e.target as HTMLInputElement).value = '';
  }, []);

  return (
    <div className="app-container">
      <ActionMenu
        images={images}
        currentImage={currentImage}
        disabled={disabled}
        buttonActions={buttonActions}
        onActionClick={onActionClick}
        onImageAction={onImageAction}
        onSettingChange={onSettingChange}
        onImageUpload={onImageUpload}
        imageLoaderRef={imageLoaderRef}
      />
      <WorkingArea />
    </div>
  );
};

export default App;
