import './component.css'

const ImageItem = () => {

    return (
        <div className='image-item-root'>
            <input type="checkbox" className='image-item-checkbox'/>
            <span className='image-item-title'>Image Item</span>
            <button className="char-button image-item-remove-button" title="Remove image">✕</button>
        </div>
    )
}

export default ImageItem;