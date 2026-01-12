import { ImageList } from './image-list';
import './component.css';


const ActionMenu = () => {

    return (
        <div className='action-menu'>
            <div className='action-menu-header'>Image poligonizer</div>
            <ImageList />
        </div>
    );
}


export default ActionMenu;