import { memo } from 'react';
import { CHECKBOX_IDS, BUTTON_IDS, LABEL_PREFIX } from './constants';

import type { FC, MouseEvent, ChangeEvent } from 'react';
import type { TFunction } from 'i18next';
import type { ExportAction, SharedExportConfig } from '../../types';

import './component.css';

type ModalFooterProps = {
    t: TFunction;
    exportConfig: SharedExportConfig;
    onAction(action: ExportAction): void;
};

const ModalFooter: FC<ModalFooterProps> = ({ t, exportConfig, onAction }) => {
    const handleAction = (event: MouseEvent<HTMLButtonElement> | ChangeEvent<HTMLInputElement>) =>
        onAction(event.currentTarget.id as ExportAction);

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
