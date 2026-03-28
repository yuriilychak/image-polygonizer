import { memo } from 'react';
import { CHECKBOX_IDS, BUTTON_IDS, LABEL_PREFIX } from './constants';
import { CROP_ALL_ID } from '../../constants';

import type { FC, MouseEvent, ChangeEvent } from 'react';
import type { TFunction } from 'i18next';
import type { SharedExportConfig, CropOption } from 'image-polygonizer';
import type { ExportAction } from '../../types';

import './component.css';

type ModalFooterProps = {
    t: TFunction;
    exportConfig: SharedExportConfig;
    onAction(action: ExportAction): void;
    onCropChange(imageId: string, value: CropOption): void;
    sharedCrop: CropOption;
};

const CROP_OPTIONS_ORDER: CropOption[] = ['none', 'alpha', 'polygon'];

const ModalFooter: FC<ModalFooterProps> = ({
    t,
    exportConfig,
    onAction,
    onCropChange,
    sharedCrop,
}) => {
    const handleAction = (event: MouseEvent<HTMLButtonElement> | ChangeEvent<HTMLInputElement>) =>
        onAction(event.currentTarget.id as ExportAction);

    const handleCropChange = (event: ChangeEvent<HTMLInputElement>) => {
        onCropChange(CROP_ALL_ID, event.currentTarget.value as CropOption);
    };

    return (
        <div className="export-modal-footer">
            {CHECKBOX_IDS.map(id => (
                <div key={id}>
                    <input
                        id={id}
                        checked={exportConfig[id as 'exportPolygons' | 'exportTriangles']}
                        type="checkbox"
                        onChange={handleAction}
                    />
                    <label htmlFor={id}>{t(`${LABEL_PREFIX}${id}`)}</label>
                </div>
            ))}
            <div className="export-modal-crop-section">
                <span>{t('export_modal_cropping_title')}</span>
                {CROP_OPTIONS_ORDER.map(option => (
                    <label key={option}>
                        <input
                            type="radio"
                            name="crop-all"
                            value={option}
                            checked={sharedCrop === option}
                            onChange={handleCropChange}
                        />
                        {t(`export_modal_crop_${option}`)}
                    </label>
                ))}
            </div>
            <div className="export-modal-footer-spacer" />
            {BUTTON_IDS.map(id => (
                <button
                    id={id}
                    key={id}
                    className="export-modal-footer-button"
                    onClick={handleAction}
                >
                    {t(`${LABEL_PREFIX}${id}`)}
                </button>
            ))}
        </div>
    );
};

export default memo(ModalFooter);
