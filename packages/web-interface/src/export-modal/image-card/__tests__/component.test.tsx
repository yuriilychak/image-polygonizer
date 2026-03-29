import { render, screen, fireEvent } from '@testing-library/react';
import { vi, beforeEach } from 'vitest';
import ExportImageCard from '../component';

vi.mock('image-polygonizer', () => ({
    PolygonData: { getInstance: vi.fn() },
    ImagePolygonizer: vi.fn(),
    NOOP: () => {},
}));

vi.mock('../image-preview', () => ({
    default: () => <div data-testid="image-preview" />,
}));

const t = (key: string) => key;

function createMockImage(id = 'img1', label = 'test.png'): any {
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
    };
}

describe('ExportImageCard', () => {
    let onCropChange: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        onCropChange = vi.fn();
    });

    it('renders image label in title overlay', () => {
        const image = createMockImage('img1', 'my-photo.png');
        render(
            <ExportImageCard
                t={t as any}
                image={image}
                selectedCrop="none"
                onCropChange={onCropChange}
            />
        );
        expect(screen.getByText('my-photo.png')).toBeInTheDocument();
    });

    it('renders 3 radio items (one for each crop option)', () => {
        render(
            <ExportImageCard
                t={t as any}
                image={createMockImage()}
                selectedCrop="none"
                onCropChange={onCropChange}
            />
        );
        expect(screen.getAllByRole('radio')).toHaveLength(3);
    });

    it('"none" radio item is checked when selectedCrop="none"', () => {
        render(
            <ExportImageCard
                t={t as any}
                image={createMockImage()}
                selectedCrop="none"
                onCropChange={onCropChange}
            />
        );
        const radios = screen.getAllByRole('radio') as HTMLInputElement[];
        const noneRadio = radios.find(r => r.id.endsWith('_none'));
        expect(noneRadio?.checked).toBe(true);
    });

    it('"alpha" radio item is checked when selectedCrop="alpha"', () => {
        render(
            <ExportImageCard
                t={t as any}
                image={createMockImage()}
                selectedCrop="alpha"
                onCropChange={onCropChange}
            />
        );
        const radios = screen.getAllByRole('radio') as HTMLInputElement[];
        const alphaRadio = radios.find(r => r.id.endsWith('_alpha'));
        expect(alphaRadio?.checked).toBe(true);
    });

    it('changing a radio item calls onCropChange(imageId, option)', () => {
        render(
            <ExportImageCard
                t={t as any}
                image={createMockImage('img1')}
                selectedCrop="none"
                onCropChange={onCropChange}
            />
        );
        const radios = screen.getAllByRole('radio') as HTMLInputElement[];
        const alphaRadio = radios.find(r => r.id === 'img1_alpha')!;
        fireEvent.click(alphaRadio);
        expect(onCropChange).toHaveBeenCalledWith('img1', 'alpha');
    });

    it('renders "No preview" div when image.src is falsy', () => {
        const image = { ...createMockImage(), src: null };
        render(
            <ExportImageCard
                t={t as any}
                image={image}
                selectedCrop="none"
                onCropChange={onCropChange}
            />
        );
        expect(screen.getByText('No preview')).toBeInTheDocument();
        expect(screen.queryByTestId('image-preview')).not.toBeInTheDocument();
    });
});
