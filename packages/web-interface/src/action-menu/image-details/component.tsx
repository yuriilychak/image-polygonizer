import { FC, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { MenuSection } from '../menu-section';
import { RangeInput } from './range-input';
import { IMAGE_SETTING_RANGES, SETTING_ORDER } from './constants';
import type { ImageConfig, SettingChangeCallback } from '../../types';
import './component.css';

type ImageDetailsProps = {
  disabled: boolean;
  onSettingChange: SettingChangeCallback;
  imageConfig: ImageConfig;
};

const ImageDetails: FC<ImageDetailsProps> = ({ disabled, onSettingChange, imageConfig }) => {
  const { t } = useTranslation();
  const title = t('menu_section_label_image_details');

  return (
    <MenuSection title={title} contentClassName="image-details-content">
      {SETTING_ORDER.map(key => (
        <RangeInput
          {...IMAGE_SETTING_RANGES[key]}
          key={key}
          id={key}
          value={imageConfig[key]}
          disabled={disabled}
          onChange={onSettingChange}
        />
      ))}
    </MenuSection>
  );
};

export default memo(ImageDetails);
