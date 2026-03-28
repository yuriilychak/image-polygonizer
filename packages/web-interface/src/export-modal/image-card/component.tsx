import { CROP_OPTIONS_ORDER } from '../constants';
import RadioItem from './radio-item';
import ImagePreview from './image-preview';

import type { FC } from 'react';
import type { TFunction } from 'i18next';
import type { ImageConfig } from 'image-polygonizer';
import type { CropOption } from 'image-polygonizer';

export type ExportImageCardProps = {
    t: TFunction;
    image: ImageConfig;
    selectedCrop?: CropOption;
    onCropChange(imageId: string, value: CropOption): void;
};

const ExportImageCard: FC<ExportImageCardProps> = ({ t, image, selectedCrop, onCropChange }) => (
    <div className="export-modal-card" key={image.id}>
        <div className="export-modal-card-preview">
            <span className="export-modal-image-title-overlay">{image.label}</span>
            {image.src ? (
                <ImagePreview src={image.src} />
            ) : (
                <div className="export-modal-no-preview">No preview</div>
            )}
            <span className="export-modal-crop-title-outside">
                {t('export_modal_cropping_title')}
            </span>
            <div
                className="export-modal-card-crop overlay"
                role="group"
                aria-label={t('export_modal_cropping_title')}
            >
                <div className="export-modal-crop-options">
                    {CROP_OPTIONS_ORDER.map(option => (
                        <RadioItem
                            key={option}
                            imageId={image.id}
                            option={option}
                            label={t(`export_modal_crop_${option}`)}
                            checked={selectedCrop === option}
                            onChange={onCropChange}
                        />
                    ))}
                </div>
            </div>
        </div>
    </div>
);

export default ExportImageCard;
