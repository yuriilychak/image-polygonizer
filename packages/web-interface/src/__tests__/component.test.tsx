import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../hooks', () => ({
    default: vi.fn().mockReturnValue({
        t: (k: string) => k,
        isLowResolution: false,
        isExportModalOpen: false,
        images: [],
        currentImage: null,
        currentLanguage: 'en',
        disabled: false,
        buttonActions: ['import'],
        imageLoaderRef: { current: null },
        exportConfig: {
            shared: { exportPolygons: true, exportTriangles: true },
            fileConfig: {},
        },
        projectName: 'Test',
        projectLoaderRef: { current: null },
        saveAnchorRef: { current: null },
        onActionClick: vi.fn(),
        onImageAction: vi.fn(),
        onSettingChange: vi.fn(),
        onImageUpload: vi.fn(),
        onProjectUpload: vi.fn(),
        onSwitchLanguage: vi.fn(),
        onProjectNameChange: vi.fn(),
        onExportAction: vi.fn(),
        onCropChange: vi.fn(),
    }),
}));

vi.mock('../action-menu', () => ({
    ActionMenu: vi.fn(() => null),
}));

vi.mock('../working-area', () => ({
    WorkingArea: vi.fn(() => null),
}));

vi.mock('../export-modal', () => ({
    ExportModal: vi.fn(() => null),
}));

// ---------------------------------------------------------------------------

import App from '../component';

// ---------------------------------------------------------------------------
describe('App component', () => {
    it('renders without throwing', () => {
        expect(() => render(<App />)).not.toThrow();
    });

    it('renders the .app-container root element', () => {
        const { container } = render(<App />);
        expect(container.querySelector('.app-container')).not.toBeNull();
    });

    it('mounts successfully and returns a container element', () => {
        const { container } = render(<App />);
        expect(container).toBeTruthy();
        expect(container.firstChild).toBeTruthy();
    });
});
