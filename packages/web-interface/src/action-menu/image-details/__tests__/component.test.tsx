import { render, screen, fireEvent } from '@testing-library/react';
import ImageDetails from '../component';

vi.mock('image-polygonizer', () => ({
    PolygonData: { getInstance: vi.fn() },
    ImagePolygonizer: vi.fn(),
    NOOP: () => {},
}));

const t = (key: string) => key;

const imageConfig = {
    maxPointCount: 20,
    alphaThreshold: 10,
    minimalDistance: 5,
};

describe('ImageDetails', () => {
    it('renders 3 range inputs (one for each setting)', () => {
        render(<ImageDetails t={t} disabled={false} onSettingChange={vi.fn()} imageConfig={imageConfig} />);
        expect(screen.getAllByRole('slider')).toHaveLength(3);
    });

    it('each range input has correct min and max from constants', () => {
        render(<ImageDetails t={t} disabled={false} onSettingChange={vi.fn()} imageConfig={imageConfig} />);
        const sliders = screen.getAllByRole('slider');
        // maxPointCount: min=4, max=255
        expect(sliders[0]).toHaveAttribute('min', '4');
        expect(sliders[0]).toHaveAttribute('max', '255');
        // alphaThreshold: min=1, max=255
        expect(sliders[1]).toHaveAttribute('min', '1');
        expect(sliders[1]).toHaveAttribute('max', '255');
        // minimalDistance: min=1, max=255
        expect(sliders[2]).toHaveAttribute('min', '1');
        expect(sliders[2]).toHaveAttribute('max', '255');
    });

    it('each range input shows the value from imageConfig', () => {
        render(<ImageDetails t={t} disabled={false} onSettingChange={vi.fn()} imageConfig={imageConfig} />);
        const sliders = screen.getAllByRole('slider');
        expect((sliders[0] as HTMLInputElement).value).toBe('20');
        expect((sliders[1] as HTMLInputElement).value).toBe('10');
        expect((sliders[2] as HTMLInputElement).value).toBe('5');
    });

    it('calls onSettingChange with id and new value when a range input changes', () => {
        const onSettingChange = vi.fn();
        render(<ImageDetails t={t} disabled={false} onSettingChange={onSettingChange} imageConfig={imageConfig} />);
        const sliders = screen.getAllByRole('slider');
        fireEvent.change(sliders[0], { target: { value: '50' } });
        expect(onSettingChange).toHaveBeenCalledWith('maxPointCount', 50);
    });
});
