import { memo } from 'react';

import type { ChangeEvent, FC } from 'react';
import type { CropOption } from 'image-polygonizer';

export type RadioItemProps = {
    imageId: string;
    option: CropOption;
    label: string;
    checked: boolean;
    onChange(imageId: string, option: CropOption): void;
};

const RadioItem: FC<RadioItemProps> = ({ imageId, option, label, checked, onChange }) => {
    const id = `${imageId}_${option}`;

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const [extractedImageId, extractedOption] = event.target.id.split('_') as [
            string,
            CropOption,
        ];
        onChange(extractedImageId, extractedOption);
    };

    return (
        <label htmlFor={id} title={label}>
            <input id={id} type="radio" value={option} checked={checked} onChange={handleChange} />
            {label}
        </label>
    );
};

export default memo(RadioItem);
