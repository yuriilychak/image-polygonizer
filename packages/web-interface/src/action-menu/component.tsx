import { ImageList } from './image-list';
import { ImageDetails } from './image-details';
import './component.css';

const ActionMenu = () => {

    return (
        <div className='action-menu'>
            <div className='action-menu-header'>Image poligonizer</div>
            <ImageList />
            <ImageDetails />
        </div>
    );
}


export default ActionMenu;