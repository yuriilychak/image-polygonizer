import { ModalHeader } from './modal-header';
import { ModalFooter } from './modal-footer';
import { ImageCard } from './image-card';

import type { ImageConfig, ExportConfig, CropOption } from 'image-polygonizer';
import type { FC } from 'react';
import type { TFunction } from 'i18next';
import type { ExportAction } from '../types';

import './component.css';

type ExportModalProps = {
    isOpen: boolean;
    t: TFunction;
    exportConfig: ExportConfig;
    images: ImageConfig[];
    onAction(action: ExportAction): void;
    onCropChange(imageId: string, value: CropOption): void;
};

const ExportModal: FC<ExportModalProps> = ({
    isOpen,
    onAction,
    t,
    exportConfig,
    images,
    onCropChange,
}) => {
    const selectedImages = images.filter(
        image => image.selected && image.hasPolygons && !image.outdated
    );

    const sharedCrop: CropOption =
        selectedImages.length === 0
            ? ''
            : selectedImages.slice(1).reduce<CropOption>(
                  (acc, image) => 
                    acc !== exportConfig.fileConfig[image.id] ? '' : acc,
                  (exportConfig.fileConfig[selectedImages[0].id] || '') as CropOption
              );

    return isOpen ? (
        <>
            <div className="export-modal-fade" />
            <div className="export-modal-body">
                <ModalHeader t={t} onAction={onAction} />
                <div className="export-modal-content">
                    {selectedImages.length === 0 ? (
                        <div className="export-modal-empty">No valid images to preview</div>
                    ) : (
                        selectedImages.map(image => (
                            <ImageCard
                                key={image.id}
                                t={t}
                                image={image}
                                selectedCrop={exportConfig.fileConfig[image.id]}
                                onCropChange={onCropChange}
                            />
                        ))
                    )}
                </div>
                <ModalFooter
                    t={t}
                    onAction={onAction}
                    exportConfig={exportConfig.shared}
                    onCropChange={onCropChange}
                    sharedCrop={sharedCrop}
                />
            </div>
        </>
    ) : null;
};

export default ExportModal;
