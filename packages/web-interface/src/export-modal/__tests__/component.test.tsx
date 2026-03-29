import { render, screen, fireEvent } from '@testing-library/react';
import { vi, beforeEach } from 'vitest';
import ExportModal from '../component';

vi.mock('image-polygonizer', () => ({
    PolygonData: { getInstance: vi.fn() },
    ImagePolygonizer: vi.fn(),
    NOOP: () => {},
}));

vi.mock('../modal-header', () => ({
    ModalHeader: ({ onAction }: any) => (
        <div data-testid="modal-header">
            <button onClick={() => onAction('cancelExport')}>close</button>
        </div>
    ),
}));

vi.mock('../modal-footer', () => ({
    ModalFooter: ({ onAction }: any) => (
        <div data-testid="modal-footer">
            <button onClick={() => onAction('submitExport')}>submit</button>
        </div>
    ),
}));

vi.mock('../image-card', () => ({
    ImageCard: ({ image }: any) => <div data-testid={`card-${image.id}`}>{image.label}</div>,
}));

const t = (key: string) => key;

function createMockImage(
    id = 'img-1',
    label = 'test.png',
    overrides: Partial<{
        selected: boolean;
        hasPolygons: boolean;
        outdated: boolean;
    }> = {}
): any {
    return {
        id,
        label,
        type: 'png',
        src: { width: 100, height: 100 } as ImageBitmap,
        selected: true,
        hasPolygons: true,
        outdated: false,
        config: { alphaThreshold: 10, minimalDistance: 5, maxPointCount: 20 },
        polygonInfo: new Uint16Array([1, 2, 3]),
        ...overrides,
    };
}

function makeExportConfig(fileConfig: Record<string, any> = {}): any {
    return {
        shared: { exportPolygons: true, exportTriangles: false },
        fileConfig,
    };
}

describe('ExportModal', () => {
    let onAction: ReturnType<typeof vi.fn>;
    let onCropChange: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        onAction = vi.fn();
        onCropChange = vi.fn();
    });

    it('returns null (nothing rendered) when isOpen=false', () => {
        const { container } = render(
            <ExportModal
                isOpen={false}
                t={t as any}
                exportConfig={makeExportConfig()}
                images={[createMockImage()]}
                onAction={onAction}
                onCropChange={onCropChange}
            />
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders fade div and modal body when isOpen=true', () => {
        const { container } = render(
            <ExportModal
                isOpen={true}
                t={t as any}
                exportConfig={makeExportConfig()}
                images={[createMockImage()]}
                onAction={onAction}
                onCropChange={onCropChange}
            />
        );
        expect(container.querySelector('.export-modal-fade')).toBeInTheDocument();
        expect(container.querySelector('.export-modal-body')).toBeInTheDocument();
    });

    it('renders "No valid images to preview" when images array has no valid images', () => {
        render(
            <ExportModal
                isOpen={true}
                t={t as any}
                exportConfig={makeExportConfig()}
                images={[]}
                onAction={onAction}
                onCropChange={onCropChange}
            />
        );
        expect(screen.getByText('No valid images to preview')).toBeInTheDocument();
    });

    it('renders ModalHeader and ModalFooter', () => {
        render(
            <ExportModal
                isOpen={true}
                t={t as any}
                exportConfig={makeExportConfig()}
                images={[createMockImage()]}
                onAction={onAction}
                onCropChange={onCropChange}
            />
        );
        expect(screen.getByTestId('modal-header')).toBeInTheDocument();
        expect(screen.getByTestId('modal-footer')).toBeInTheDocument();
    });

    it('renders ImageCard only for selected+hasPolygons+!outdated images', () => {
        const validImage = createMockImage('valid-img', 'valid.png');
        render(
            <ExportModal
                isOpen={true}
                t={t as any}
                exportConfig={makeExportConfig()}
                images={[validImage]}
                onAction={onAction}
                onCropChange={onCropChange}
            />
        );
        expect(screen.getByTestId('card-valid-img')).toBeInTheDocument();
        expect(screen.getByText('valid.png')).toBeInTheDocument();
    });

    it('non-selected images are not rendered in content', () => {
        const nonSelected = createMockImage('ns-img', 'ns.png', { selected: false });
        render(
            <ExportModal
                isOpen={true}
                t={t as any}
                exportConfig={makeExportConfig()}
                images={[nonSelected]}
                onAction={onAction}
                onCropChange={onCropChange}
            />
        );
        expect(screen.queryByTestId('card-ns-img')).not.toBeInTheDocument();
        expect(screen.getByText('No valid images to preview')).toBeInTheDocument();
    });

    it('outdated images are not rendered in content', () => {
        const outdatedImage = createMockImage('old-img', 'old.png', { outdated: true });
        render(
            <ExportModal
                isOpen={true}
                t={t as any}
                exportConfig={makeExportConfig()}
                images={[outdatedImage]}
                onAction={onAction}
                onCropChange={onCropChange}
            />
        );
        expect(screen.queryByTestId('card-old-img')).not.toBeInTheDocument();
        expect(screen.getByText('No valid images to preview')).toBeInTheDocument();
    });
});
