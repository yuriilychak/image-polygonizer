import type { FC } from 'react';
import type { TFunction } from 'i18next';
import type { ImageConfig } from 'image-polygonizer';

import { ImagePreview } from './image-preview';

export type ExportImageCardProps = {
    t: TFunction;
    image: ImageConfig;
    selectedCrop?: string;
    onCropChange(imageId: string, value: string): void;
};

const CROP_OPTIONS = ['none', 'alpha', 'polygon'] as const;

const CropOptionLabels: Record<(typeof CROP_OPTIONS)[number], string> = {
    none: 'export_modal_crop_none',
    alpha: 'export_modal_crop_alpha',
    polygon: 'export_modal_crop_polygon',
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
                    {CROP_OPTIONS.map(option => (
                        <label key={option} title={t(`export_modal_crop_tooltip_${option}`)}>
                            <input
                                type="radio"
                                name={`crop-${image.id}`}
                                value={option}
                                checked={selectedCrop === option}
                                onChange={() => onCropChange(image.id, option)}
                            />
                            {t(CropOptionLabels[option])}
                        </label>
                    ))}
                </div>
            </div>
        </div>
    </div>
);

export default ExportImageCard;
