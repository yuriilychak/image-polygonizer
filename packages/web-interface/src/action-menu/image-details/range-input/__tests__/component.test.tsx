import { render, screen, fireEvent } from '@testing-library/react';
import RangeInput from '../component';

const t = (key: string) => key;

describe('RangeInput', () => {
    const defaultProps = {
        t,
        id: 'maxPointCount' as const,
        min: 4,
        max: 255,
        value: 100,
        disabled: false,
        onChange: vi.fn(),
    };

    it('renders range input with correct min, max, value and step attributes', () => {
        render(<RangeInput {...defaultProps} />);
        const input = screen.getByRole('slider');
        expect(input).toHaveAttribute('min', '4');
        expect(input).toHaveAttribute('max', '255');
        expect(input).toHaveAttribute('step', '1');
        expect((input as HTMLInputElement).value).toBe('100');
    });

    it('renders label with correct text from translation key', () => {
        render(<RangeInput {...defaultProps} />);
        expect(screen.getByText('image_config_input_label_maxPointCount')).toBeInTheDocument();
    });

    it('renders help icon with correct title', () => {
        render(<RangeInput {...defaultProps} />);
        expect(screen.getByTitle('image_config_input_help_maxPointCount')).toBeInTheDocument();
    });

    it('shows current value in a span', () => {
        render(<RangeInput {...defaultProps} value={42} />);
        expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('calls onChange with id and numeric value when input changes', () => {
        const onChange = vi.fn();
        render(<RangeInput {...defaultProps} onChange={onChange} />);
        fireEvent.change(screen.getByRole('slider'), { target: { value: '150' } });
        expect(onChange).toHaveBeenCalledWith('maxPointCount', 150);
    });

    it('input is disabled when disabled=true', () => {
        render(<RangeInput {...defaultProps} disabled={true} />);
        expect(screen.getByRole('slider')).toBeDisabled();
    });
});
