import { render, screen, fireEvent } from '@testing-library/react';
import { vi, beforeEach } from 'vitest';
import ModalFooter from '../component';

vi.mock('image-polygonizer', () => ({
    PolygonData: { getInstance: vi.fn() },
    ImagePolygonizer: vi.fn(),
    NOOP: () => {},
}));

const t = (key: string) => key;

function makeExportConfig(exportPolygons = true, exportTriangles = false) {
    return { exportPolygons, exportTriangles } as any;
}

describe('ModalFooter', () => {
    let onAction: ReturnType<typeof vi.fn>;
    let onCropChange: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        onAction = vi.fn();
        onCropChange = vi.fn();
    });

    it('renders exportPolygons checkbox as checked when exportConfig.exportPolygons=true', () => {
        render(
            <ModalFooter
                t={t as any}
                exportConfig={makeExportConfig(true, false)}
                onAction={onAction}
                onCropChange={onCropChange}
                sharedCrop="none"
            />
        );
        const checkbox = document.getElementById('exportPolygons') as HTMLInputElement;
        expect(checkbox).toBeInTheDocument();
        expect(checkbox.checked).toBe(true);
    });

    it('renders exportTriangles checkbox as unchecked when exportConfig.exportTriangles=false', () => {
        render(
            <ModalFooter
                t={t as any}
                exportConfig={makeExportConfig(true, false)}
                onAction={onAction}
                onCropChange={onCropChange}
                sharedCrop="none"
            />
        );
        const checkbox = document.getElementById('exportTriangles') as HTMLInputElement;
        expect(checkbox).toBeInTheDocument();
        expect(checkbox.checked).toBe(false);
    });

    it('renders 3 crop radio buttons (none, alpha, polygon)', () => {
        render(
            <ModalFooter
                t={t as any}
                exportConfig={makeExportConfig()}
                onAction={onAction}
                onCropChange={onCropChange}
                sharedCrop="none"
            />
        );
        const radios = screen.getAllByRole('radio');
        expect(radios).toHaveLength(3);
    });

    it('"none" radio is checked when sharedCrop="none"', () => {
        render(
            <ModalFooter
                t={t as any}
                exportConfig={makeExportConfig()}
                onAction={onAction}
                onCropChange={onCropChange}
                sharedCrop="none"
            />
        );
        const radios = screen.getAllByRole('radio') as HTMLInputElement[];
        const noneRadio = radios.find(r => r.value === 'none');
        expect(noneRadio?.checked).toBe(true);
    });

    it('changing exportPolygons checkbox calls onAction("exportPolygons")', () => {
        render(
            <ModalFooter
                t={t as any}
                exportConfig={makeExportConfig()}
                onAction={onAction}
                onCropChange={onCropChange}
                sharedCrop="none"
            />
        );
        const checkbox = document.getElementById('exportPolygons') as HTMLInputElement;
        fireEvent.click(checkbox);
        expect(onAction).toHaveBeenCalledWith('exportPolygons');
    });

    it('clicking cancelExport button calls onAction("cancelExport")', () => {
        render(
            <ModalFooter
                t={t as any}
                exportConfig={makeExportConfig()}
                onAction={onAction}
                onCropChange={onCropChange}
                sharedCrop="none"
            />
        );
        const btn = document.getElementById('cancelExport') as HTMLButtonElement;
        fireEvent.click(btn);
        expect(onAction).toHaveBeenCalledWith('cancelExport');
    });

    it('clicking submitExport button calls onAction("submitExport")', () => {
        render(
            <ModalFooter
                t={t as any}
                exportConfig={makeExportConfig()}
                onAction={onAction}
                onCropChange={onCropChange}
                sharedCrop="none"
            />
        );
        const btn = document.getElementById('submitExport') as HTMLButtonElement;
        fireEvent.click(btn);
        expect(onAction).toHaveBeenCalledWith('submitExport');
    });

    it('changing crop radio to "alpha" calls onCropChange("All", "alpha")', () => {
        render(
            <ModalFooter
                t={t as any}
                exportConfig={makeExportConfig()}
                onAction={onAction}
                onCropChange={onCropChange}
                sharedCrop="none"
            />
        );
        const radios = screen.getAllByRole('radio') as HTMLInputElement[];
        const alphaRadio = radios.find(r => r.value === 'alpha')!;
        fireEvent.click(alphaRadio);
        expect(onCropChange).toHaveBeenCalledWith('All', 'alpha');
    });
});
