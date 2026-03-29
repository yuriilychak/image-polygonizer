import { render, screen, fireEvent } from '@testing-library/react';
import MenuSection from '../component';

vi.mock('image-polygonizer', () => ({
    PolygonData: { getInstance: vi.fn() },
    ImagePolygonizer: vi.fn(),
    NOOP: () => {},
}));

const t = (key: string) => key;

describe('MenuSection', () => {
    it('renders title', () => {
        render(
            <MenuSection t={t} titleKey="my_title">
                <div />
            </MenuSection>,
        );
        expect(screen.getByText('my_title')).toBeInTheDocument();
    });

    it('renders children', () => {
        render(
            <MenuSection t={t} titleKey="my_title">
                <div>child content</div>
            </MenuSection>,
        );
        expect(screen.getByText('child content')).toBeInTheDocument();
    });

    it('renders no checkbox when selectAction not provided', () => {
        render(
            <MenuSection t={t} titleKey="my_title">
                <div />
            </MenuSection>,
        );
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('renders checkbox when selectAction is provided', () => {
        render(
            <MenuSection t={t} titleKey="my_title" selectAction="toggleSelectAllImages" onAction={vi.fn()}>
                <div />
            </MenuSection>,
        );
        expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('checkbox onChange calls onAction with selectAction, empty string and null', () => {
        const onAction = vi.fn();
        render(
            <MenuSection t={t} titleKey="my_title" selectAction="toggleSelectAllImages" onAction={onAction}>
                <div />
            </MenuSection>,
        );
        fireEvent.click(screen.getByRole('checkbox'));
        expect(onAction).toHaveBeenCalledWith('toggleSelectAllImages', '', null);
    });

    it('renders action buttons for each action in actions array', () => {
        const onAction = vi.fn();
        render(
            <MenuSection t={t} titleKey="my_title" actions={['addImages']} onAction={onAction} disabled={false}>
                <div />
            </MenuSection>,
        );
        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('applies className to root element', () => {
        const { container } = render(
            <MenuSection t={t} titleKey="my_title" className="custom-class">
                <div />
            </MenuSection>,
        );
        expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });

    it('applies contentClassName to content wrapper', () => {
        const { container } = render(
            <MenuSection t={t} titleKey="my_title" contentClassName="custom-content">
                <div />
            </MenuSection>,
        );
        expect(container.querySelector('.custom-content')).toBeInTheDocument();
    });
});
