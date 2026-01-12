import { ImageItem } from './image-item';
import './component.css'

const ImageList = () => {

    return (
        <div className='image-list-root'>
            <div className='image-list-header'>
                <span className="image-list-header-title">Images</span>
                <button className="char-button" title="Add new image">+</button>
            </div>
            <div className='image-list-content'>
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
            </div>
        </div>
    )
}

export default ImageList;