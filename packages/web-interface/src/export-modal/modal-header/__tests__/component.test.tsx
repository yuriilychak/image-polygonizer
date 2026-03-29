import { render, screen, fireEvent } from '@testing-library/react';
import { vi, beforeEach } from 'vitest';
import ModalHeader from '../component';

vi.mock('image-polygonizer', () => ({
    PolygonData: { getInstance: vi.fn() },
    ImagePolygonizer: vi.fn(),
    NOOP: () => {},
}));

const t = (key: string) => key;

describe('ModalHeader', () => {
    let onAction: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        onAction = vi.fn();
    });

    it('renders title span with text "export_modal_title"', () => {
        render(<ModalHeader t={t as any} onAction={onAction} />);
        expect(screen.getByText('export_modal_title')).toBeInTheDocument();
    });

    it('renders close button with text "×"', () => {
        render(<ModalHeader t={t as any} onAction={onAction} />);
        expect(screen.getByRole('button', { name: '×' })).toBeInTheDocument();
    });

    it('clicking close button calls onAction("cancelExport")', () => {
        render(<ModalHeader t={t as any} onAction={onAction} />);
        fireEvent.click(screen.getByRole('button', { name: '×' }));
        expect(onAction).toHaveBeenCalledWith('cancelExport');
    });
});
