import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActionMenu from '../component';

vi.mock('image-polygonizer', () => ({
    PolygonData: { getInstance: vi.fn() },
    ImagePolygonizer: vi.fn(),
    NOOP: () => {},
}));

vi.mock('../image-list', () => ({ ImageList: () => <div data-testid="image-list" /> }));
vi.mock('../image-details', () => ({ ImageDetails: () => <div data-testid="image-details" /> }));
vi.mock('../actions-section', () => ({ ActionsSection: () => <div data-testid="actions-section" /> }));
vi.mock('../project-name', () => ({ ProjectName: () => <div data-testid="project-name" /> }));

const t = (key: string) => key;

const defaultProps = {
    t,
    images: [],
    isLowResolution: false,
    projectName: 'My Project',
    currentLanguage: 'en' as const,
    currentImage: null,
    imageLoaderRef: { current: null } as any,
    projectLoaderRef: { current: null } as any,
    saveAnchorRef: { current: null } as any,
    buttonActions: ['import'] as any,
    onActionClick: vi.fn(),
    onSettingChange: vi.fn(),
    onImageAction: vi.fn(),
    onImageUpload: vi.fn(),
    onProjectUpload: vi.fn(),
    onProjectNameChange: vi.fn(),
    onSwitchLanguage: vi.fn(),
    disabled: false,
};

describe('ActionMenu', () => {
    it('renders the action-menu container', () => {
        const { container } = render(<ActionMenu {...defaultProps} />);
        expect(container.querySelector('.action-menu')).toBeInTheDocument();
    });

    it('renders project name component', () => {
        render(<ActionMenu {...defaultProps} />);
        expect(screen.getByTestId('project-name')).toBeInTheDocument();
    });

    it('renders language button showing currentLanguage', () => {
        render(<ActionMenu {...defaultProps} />);
        expect(screen.getByTitle('button_label_language')).toHaveTextContent('en');
    });

    it('renders GitHub link', () => {
        render(<ActionMenu {...defaultProps} />);
        expect(screen.getByTitle('GitHub')).toBeInTheDocument();
    });

    it('shows SVG open-drawer icon in low-resolution mode', () => {
        const { container } = render(<ActionMenu {...defaultProps} isLowResolution={true} />);
        expect(container.querySelector('.action-menu-low-res-icon')).toBeInTheDocument();
    });

    it('does not show SVG open-drawer icon when not in low-resolution mode', () => {
        const { container } = render(<ActionMenu {...defaultProps} isLowResolution={false} />);
        expect(container.querySelector('.action-menu-low-res-icon')).not.toBeInTheDocument();
    });

    it('language button click calls onSwitchLanguage', async () => {
        const user = userEvent.setup();
        const onSwitchLanguage = vi.fn();
        render(<ActionMenu {...defaultProps} onSwitchLanguage={onSwitchLanguage} />);
        await user.click(screen.getByTitle('button_label_language'));
        expect(onSwitchLanguage).toHaveBeenCalled();
    });
});
