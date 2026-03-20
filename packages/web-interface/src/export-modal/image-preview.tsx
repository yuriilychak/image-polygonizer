import { useEffect, useState } from 'react';
import type { FC } from 'react';

type ImagePreviewProps = {
    src: ImageBitmap;
};

export const ImagePreview: FC<ImagePreviewProps> = ({ src }) => {
    const [imgSrc, setImgSrc] = useState<string>('');
    const size = 200;

    useEffect(() => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            setImgSrc('');
            return;
        }

        ctx.clearRect(0, 0, size, size);

        const ratio = Math.min(size / src.width, size / src.height);
        const width = src.width * ratio;
        const height = src.height * ratio;
        const x = (size - width) / 2;
        const y = (size - height) / 2;

        ctx.drawImage(src, x, y, width, height);

        const dataUrl = canvas.toDataURL('image/png');
        setImgSrc(dataUrl);
    }, [src]);

    return (
        <div className="export-modal-preview-wrapper" style={{ width: size, height: size }}>
            <img
                src={imgSrc}
                className="export-modal-preview"
                width={size}
                height={size}
                alt="Image preview"
            />
        </div>
    );
};
