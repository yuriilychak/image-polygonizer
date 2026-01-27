import { memo } from 'react';
import { MenuSection } from '../shared';
import { RangeInput } from './range-input';
import { IMAGE_SETTING_RANGES, SETTING_ORDER } from './constants';

import type { FC } from 'react';
import type { TFunction } from 'i18next';
import type { ImageSetting, SettingChangeCallback } from '../../types';

import './component.css';

type ImageDetailsProps = {
    t: TFunction;
    disabled: boolean;
    onSettingChange: SettingChangeCallback;
    imageConfig: ImageSetting;
};

const ImageDetails: FC<ImageDetailsProps> = ({ t, disabled, onSettingChange, imageConfig }) => (
    <MenuSection
        t={t}
        titleKey="menu_section_label_image_details"
        contentClassName="image-details-content"
    >
        {SETTING_ORDER.map(key => (
            <RangeInput
                {...IMAGE_SETTING_RANGES[key]}
                key={key}
                id={key}
                t={t}
                value={imageConfig[key]}
                disabled={disabled}
                onChange={onSettingChange}
            />
        ))}
    </MenuSection>
);

export default memo(ImageDetails);
