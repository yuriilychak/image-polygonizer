import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActionButton from '../component';

const t = (key: string) => key;

describe('ActionButton', () => {
    it('renders button with className char-button', () => {
        render(<ActionButton t={t} action="renameImage" disabled={false} onAction={vi.fn()} />);
        expect(screen.getByRole('button')).toHaveClass('char-button');
    });

    it('has title equal to menu_action_title_renameImage', () => {
        render(<ActionButton t={t} action="renameImage" disabled={false} onAction={vi.fn()} />);
        expect(screen.getByRole('button')).toHaveAttribute('title', 'menu_action_title_renameImage');
    });

    it('shows correct char ✓ for renameImage', () => {
        render(<ActionButton t={t} action="renameImage" disabled={false} onAction={vi.fn()} />);
        expect(screen.getByRole('button')).toHaveTextContent('✓');
    });

    it('button is disabled when disabled=true', () => {
        render(<ActionButton t={t} action="renameImage" disabled={true} onAction={vi.fn()} />);
        expect(screen.getByRole('button')).toBeDisabled();
    });

    it('click calls onAction with action and imageId', async () => {
        const user = userEvent.setup();
        const onAction = vi.fn();
        render(
            <ActionButton t={t} action="renameImage" imageId="img-1" disabled={false} onAction={onAction} />,
        );
        await user.click(screen.getByRole('button'));
        expect(onAction).toHaveBeenCalledWith('renameImage', 'img-1');
    });

    it('click stops event propagation', async () => {
        const user = userEvent.setup();
        const parentClick = vi.fn();
        render(
            <div onClick={parentClick}>
                <ActionButton t={t} action="renameImage" imageId="img-1" disabled={false} onAction={vi.fn()} />
            </div>,
        );
        await user.click(screen.getByRole('button'));
        expect(parentClick).not.toHaveBeenCalled();
    });

    it('uses empty string as default imageId when not provided', async () => {
        const user = userEvent.setup();
        const onAction = vi.fn();
        render(<ActionButton t={t} action="renameImage" disabled={false} onAction={onAction} />);
        await user.click(screen.getByRole('button'));
        expect(onAction).toHaveBeenCalledWith('renameImage', '');
    });
});
