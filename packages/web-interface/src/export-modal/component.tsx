import { ModalHeader } from './modal-header';
import { ModalFooter } from './modal-footer';

import type { FC } from 'react';
import type { TFunction } from 'i18next';
import type { ExportAction, ExportConfig } from '../types';

import './component.css';

type ExportModalProps = {
    isOpen: boolean;
    t: TFunction;
    exportConfig: ExportConfig;
    onAction(action: ExportAction): void;
};

const ExportModal: FC<ExportModalProps> = ({ isOpen, onAction, t, exportConfig }) =>
    isOpen ? (
        <>
            <div className="export-modal-fade" />
            <div className="export-modal-body">
                <ModalHeader t={t} onAction={onAction} />
                <div className="export-modal-content">data 1</div>
                <ModalFooter t={t} onAction={onAction} exportConfig={exportConfig.shared} />
            </div>
        </>
    ) : null;

export default ExportModal;
