import type { FC } from 'react';
import type { TFunction } from 'i18next';

import './component.css';

type ExportModalProps = {
    isOpen: boolean;
    t: TFunction;
    onCancel(): void;
};

const ExportModal: FC<ExportModalProps> = ({ isOpen, onCancel, t }) =>
    isOpen ? (
        <>
            <div className="export-modal-fade" />
            <div className="export-modal-body">
                <div className="export-modal-header">
                    <span className="export-modal-title">{t('export_modal_title')}</span>
                    <button className="export-modal-close-button" onClick={onCancel}>
                        ×
                    </button>
                </div>
                <div className="export-modal-content">Content</div>
                <div className="export-modal-footer">
                    <button className="export-modal-footer-button" onClick={onCancel}>
                        {t('export_modal_button_label_cancel')}
                    </button>
                    <button className="export-modal-footer-button">
                        {t('export_modal_button_label_export')}
                    </button>
                </div>
            </div>
        </>
    ) : null;

export default ExportModal;
