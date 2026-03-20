import { memo } from 'react';

import type { FC } from 'react';
import type { TFunction } from 'i18next';
import type { ExportAction } from '../../types';

import './component.css';

type ModalHeaderProps = {
    t: TFunction;
    onAction(action: ExportAction): void;
};

const ModalHeader: FC<ModalHeaderProps> = ({ t, onAction }) => {
    const handleClose = () => onAction('cancelExport');

    return (
        <div className="export-modal-header">
            <span className="export-modal-title">{t('export_modal_title')}</span>
            <button className="export-modal-close-button" onClick={handleClose}>×</button>
        </div>
    );
}

export default memo(ModalHeader);