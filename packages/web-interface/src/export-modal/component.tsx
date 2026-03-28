import { useState } from 'react';
import { ModalHeader } from './modal-header';
import { ModalFooter } from './modal-footer';
import { ImageCard } from './image-card';

import type { ImageConfig } from 'image-polygonizer';
import type { FC } from 'react';
import type { TFunction } from 'i18next';
import type { ExportAction, ExportConfig } from '../types';

import './component.css';

type ExportModalProps = {
    isOpen: boolean;
    t: TFunction;
    exportConfig: ExportConfig;
    images: ImageConfig[];
    onAction(action: ExportAction): void;
};

const ExportModal: FC<ExportModalProps> = ({ isOpen, onAction, t, exportConfig, images }) => {
    const [cropSelection, setCropSelection] = useState<Record<string, string>>({});

    const selectedImages = images.filter(
        image => image.selected && image.hasPolygons && !image.outdated
    );

    const onCropChange = (imageId: string, value: string) => {
        setCropSelection(prev => ({ ...prev, [imageId]: value }));
    };

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
                                selectedCrop={cropSelection[image.id]}
                                onCropChange={onCropChange}
                            />
                        ))
                    )}
                </div>
                <ModalFooter t={t} onAction={onAction} exportConfig={exportConfig.shared} />
            </div>
        </>
    ) : null;
};

export default ExportModal;
