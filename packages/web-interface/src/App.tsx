import { useCallback, useReducer, ChangeEvent, useRef } from 'react';
import { ActionMenu } from './action-menu';
import { WorkingArea } from './working-area';
import { ButtonActionCallback, ImageActionCallback, ImageMetadata, SettingChangeCallback } from './types';
import { INITIAL_STATE, REDUCER } from './reducer';
import './App.css';


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
  }, []);

  const onSettingChange: SettingChangeCallback = useCallback((id, value) => {
    dispatch({ type: 'updateImageConfig', payload: { id, value } });
  }, []);

  const onImageAction: ImageActionCallback = useCallback((action, id) => {
    switch (action) {
      case 'add':
        imageLoaderRef.current?.click();
        break;
      case 'remove':
        dispatch({ type: 'removeImage', payload: id });
        break;
      case 'select':
        dispatch({ type: 'setCurrentImage', payload: id });
        break;
      case`check`:
        dispatch({ type: 'toggleImage', payload: id });
        break
      default:
        break;
    }
  }, []);

  const onImageUpload = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const result: ImageMetadata[] = [];
    const files = e.target.files;
    if (!files) return;

    dispatch({ type: 'setDisabled' });

    for (let i = 0; i < files.length; ++i) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        try {
          const bitmap = await createImageBitmap(file);
          const metadata: ImageMetadata = {
            label: file.name,
            type: file.type,
            src: bitmap
          };
          result.push(metadata);
        } catch (error) {
          console.error('Error processing file:', file.name, error);
        }
      }
    }
    
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
