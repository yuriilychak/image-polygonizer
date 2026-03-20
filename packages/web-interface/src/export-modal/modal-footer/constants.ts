import type { ExportAction } from '../../types';

export const CHECKBOX_IDS: ExportAction[] = ['exportPolygons', 'exportTriangles'] as const;

export const BUTTON_IDS: ExportAction[] = ['cancelExport', 'submitExport'] as const;

export const LABEL_PREFIX = 'export_modal_button_label_';