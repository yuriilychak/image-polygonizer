import { ImageItem } from './image-item';
import { MenuSection } from '../menu-section';
import './component.css'

const ACTIONS = [{id: 'add-image', label: '+', title: 'Add new image'}];

const ImageList = () => (
    <MenuSection 
        title="Images" 
        className="image-list-root"
        contentClassName="image-list-content"
        actions={ACTIONS}
    >
            <ImageItem/>
            <ImageItem/>
            <ImageItem/>
            <ImageItem/>
            <ImageItem/>
            <ImageItem/>
            <ImageItem/>
            <ImageItem/>
            <ImageItem/>
            <ImageItem/>
            <ImageItem/>
            <ImageItem/>
            <ImageItem/>
            <ImageItem/>
            <ImageItem/>
            <ImageItem/>
            <ImageItem/>
            <ImageItem/>
            <ImageItem/>
            <ImageItem/>
            <ImageItem/>
            <ImageItem/>
            <ImageItem/>
            <ImageItem/>
    </MenuSection>
);

export default ImageList;