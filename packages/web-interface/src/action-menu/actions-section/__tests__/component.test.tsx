import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActionsSection from '../component';

vi.mock('image-polygonizer', () => ({
    PolygonData: { getInstance: vi.fn() },
    ImagePolygonizer: vi.fn(),
    NOOP: () => {},
}));

const t = (key: string) => key;

describe('ActionsSection', () => {
    it('renders buttons for each action in actions array', () => {
        render(
            <ActionsSection t={t} actions={['generate', 'export']} onActionClick={vi.fn()} disabled={false} />,
        );
        expect(screen.getByText('action_button_label_generate')).toBeInTheDocument();
        expect(screen.getByText('action_button_label_export')).toBeInTheDocument();
    });

    it('button text equals action_button_label_${action}', () => {
        render(
            <ActionsSection t={t} actions={['save']} onActionClick={vi.fn()} disabled={false} />,
        );
        expect(screen.getByText('action_button_label_save')).toBeInTheDocument();
    });

    it('clicking button calls onActionClick with that action', async () => {
        const user = userEvent.setup();
        const onActionClick = vi.fn();
        render(
            <ActionsSection t={t} actions={['generate']} onActionClick={onActionClick} disabled={false} />,
        );
        await user.click(screen.getByText('action_button_label_generate'));
        expect(onActionClick).toHaveBeenCalledWith('generate');
    });

    it('buttons are disabled when disabled=true', () => {
        render(
            <ActionsSection t={t} actions={['generate']} onActionClick={vi.fn()} disabled={true} />,
        );
        expect(screen.getByText('action_button_label_generate')).toBeDisabled();
    });
});
