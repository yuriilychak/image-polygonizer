import { memo } from 'react';
import { MenuSection } from '../shared';
import { RangeInput } from './range-input';
import { IMAGE_SETTING_RANGES } from './constants';

import type { FC } from 'react';
import type { TFunction } from 'i18next';
import type { ImageSetting } from 'image-polygonizer';
import type { SettingChangeCallback } from '../../types';

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
        {IMAGE_SETTING_RANGES.map(rangeSetting => (
            <RangeInput
                {...rangeSetting}
                key={rangeSetting.id}
                t={t}
                value={imageConfig[rangeSetting.id]}
                disabled={disabled}
                onChange={onSettingChange}
            />
        ))}
    </MenuSection>
);

export default memo(ImageDetails);
