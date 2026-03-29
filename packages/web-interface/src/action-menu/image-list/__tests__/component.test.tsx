import { render, screen } from '@testing-library/react';
import ImageList from '../component';

vi.mock('image-polygonizer', () => ({
    PolygonData: { getInstance: vi.fn() },
    ImagePolygonizer: vi.fn(),
    NOOP: () => {},
}));

const t = (key: string) => key;

type ImageConfig = {
    id: string;
    label: string;
    type: string;
    src: ImageBitmap;
    selected: boolean;
    hasPolygons: boolean;
    outdated: boolean;
    config: { alphaThreshold: number; minimalDistance: number; maxPointCount: number };
    polygonInfo: null;
};

function createMockImage(overrides: Partial<ImageConfig> = {}): ImageConfig {
    return {
        id: 'img-1',
        label: 'test.png',
        type: 'png',
        src: {} as ImageBitmap,
        selected: false,
        hasPolygons: false,
        outdated: false,
        config: { alphaThreshold: 10, minimalDistance: 5, maxPointCount: 20 },
        polygonInfo: null,
        ...overrides,
    };
}

describe('ImageList', () => {
    it('renders no image items when images=[]', () => {
        const { container } = render(
            <ImageList t={t} images={[]} disabled={false} onImageAction={vi.fn()} />,
        );
        expect(container.querySelectorAll('.image-item-root')).toHaveLength(0);
    });

    it('renders one ImageItem per image (check by label text)', () => {
        const images = [
            createMockImage({ id: 'img-1', label: 'first.png' }),
            createMockImage({ id: 'img-2', label: 'second.png' }),
        ];
        render(<ImageList t={t} images={images} disabled={false} onImageAction={vi.fn()} />);
        expect(screen.getByText('first.png')).toBeInTheDocument();
        expect(screen.getByText('second.png')).toBeInTheDocument();
    });

    it('current image has image-item-root-current class', () => {
        const images = [
            createMockImage({ id: 'img-1', label: 'first.png' }),
            createMockImage({ id: 'img-2', label: 'second.png' }),
        ];
        const { container } = render(
            <ImageList
                t={t}
                images={images}
                disabled={false}
                onImageAction={vi.fn()}
                currentImageId="img-1"
            />,
        );
        const currentItems = container.querySelectorAll('.image-item-root-current');
        expect(currentItems).toHaveLength(1);
    });
});
