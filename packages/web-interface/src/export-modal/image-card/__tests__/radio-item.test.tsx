import { render, screen, fireEvent } from '@testing-library/react';
import { vi, beforeEach } from 'vitest';
import RadioItem from '../radio-item';

vi.mock('image-polygonizer', () => ({
    PolygonData: { getInstance: vi.fn() },
    ImagePolygonizer: vi.fn(),
    NOOP: () => {},
}));

describe('RadioItem', () => {
    let onChange: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        onChange = vi.fn();
    });

    it('renders radio input with correct id (imageId + "_" + option)', () => {
        render(
            <RadioItem
                imageId="img1"
                option="none"
                label="None"
                checked={false}
                onChange={onChange}
            />
        );
        expect(document.getElementById('img1_none')).toBeInTheDocument();
    });

    it('label text shows the label prop', () => {
        render(
            <RadioItem
                imageId="img1"
                option="none"
                label="No Crop"
                checked={false}
                onChange={onChange}
            />
        );
        expect(screen.getByText('No Crop')).toBeInTheDocument();
    });

    it('input is checked when checked=true', () => {
        render(
            <RadioItem
                imageId="img1"
                option="none"
                label="None"
                checked={true}
                onChange={onChange}
            />
        );
        const input = document.getElementById('img1_none') as HTMLInputElement;
        expect(input.checked).toBe(true);
    });

    it('input is not checked when checked=false', () => {
        render(
            <RadioItem
                imageId="img1"
                option="none"
                label="None"
                checked={false}
                onChange={onChange}
            />
        );
        const input = document.getElementById('img1_none') as HTMLInputElement;
        expect(input.checked).toBe(false);
    });

    it('changing the input calls onChange(imageId, option)', () => {
        render(
            <RadioItem
                imageId="img1"
                option="none"
                label="None"
                checked={false}
                onChange={onChange}
            />
        );
        const input = document.getElementById('img1_none') as HTMLInputElement;
        fireEvent.click(input);
        expect(onChange).toHaveBeenCalledWith('img1', 'none');
    });
});
