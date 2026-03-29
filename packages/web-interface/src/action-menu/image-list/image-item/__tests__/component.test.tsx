import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImageItem from '../component';

vi.mock('image-polygonizer', () => ({
    PolygonData: { getInstance: vi.fn() },
    ImagePolygonizer: vi.fn(),
    NOOP: () => {},
}));

const t = (key: string) => key;

const defaultProps = {
    t,
    id: 'img-1',
    label: 'test.png',
    type: 'png',
    disabled: false,
    selected: false,
    outdated: false,
    hasPolygons: true,
    isCurrent: false,
    onAction: vi.fn(),
};

describe('ImageItem', () => {
    it('renders label text initially', () => {
        render(<ImageItem {...defaultProps} />);
        expect(screen.getByText('test.png')).toBeInTheDocument();
    });

    it('shows type in the type indicator div', () => {
        render(<ImageItem {...defaultProps} />);
        expect(screen.getByText('png')).toBeInTheDocument();
    });

    it('checkbox is checked when selected=true', () => {
        render(<ImageItem {...defaultProps} selected={true} />);
        expect(screen.getByRole('checkbox')).toBeChecked();
    });

    it('root has image-item-root-current class when isCurrent=true', () => {
        const { container } = render(<ImageItem {...defaultProps} isCurrent={true} />);
        expect(container.firstChild).toHaveClass('image-item-root-current');
    });

    it('root has image-item-root-disabled class when disabled=true', () => {
        const { container } = render(<ImageItem {...defaultProps} disabled={true} />);
        expect(container.firstChild).toHaveClass('image-item-root-disabled');
    });

    it('clicking openEditMode button shows rename input', async () => {
        const user = userEvent.setup();
        render(<ImageItem {...defaultProps} />);
        await user.click(screen.getByTitle('menu_action_title_openEditMode'));
        expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('renders warning icon when outdated=true', () => {
        render(<ImageItem {...defaultProps} outdated={true} />);
        expect(screen.getByTitle('menu_action_title_polygonsOutdated')).toBeInTheDocument();
    });
});
