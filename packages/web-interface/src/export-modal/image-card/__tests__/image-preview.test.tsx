import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import ImagePreview from '../image-preview';

vi.mock('image-polygonizer', () => ({
    PolygonData: { getInstance: vi.fn() },
    ImagePolygonizer: vi.fn(),
    NOOP: () => {},
}));

function createMockImageBitmap(width = 100, height = 100): ImageBitmap {
    return { width, height } as ImageBitmap;
}

describe('ImagePreview', () => {
    it('renders wrapper div with className "export-modal-preview-wrapper"', () => {
        const { container } = render(<ImagePreview src={createMockImageBitmap()} />);
        expect(container.querySelector('.export-modal-preview-wrapper')).toBeInTheDocument();
    });

    it('renders img with className "export-modal-preview"', () => {
        render(<ImagePreview src={createMockImageBitmap()} />);
        expect(screen.getByRole('img')).toHaveClass('export-modal-preview');
    });

    it('img has alt="Image preview"', () => {
        render(<ImagePreview src={createMockImageBitmap()} />);
        expect(screen.getByAltText('Image preview')).toBeInTheDocument();
    });

    it('img has width=200 and height=200', () => {
        render(<ImagePreview src={createMockImageBitmap()} />);
        const img = screen.getByRole('img') as HTMLImageElement;
        expect(img.width).toBe(200);
        expect(img.height).toBe(200);
    });

    it('img src is set to the toDataURL mock value after effect runs', async () => {
        render(<ImagePreview src={createMockImageBitmap()} />);
        await waitFor(() => {
            const img = screen.getByRole('img') as HTMLImageElement;
            expect(img.src).toContain('data:image/png;base64,mock');
        });
    });
});
