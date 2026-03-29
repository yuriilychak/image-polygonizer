import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectName from '../component';

const t = (key: string) => key;

describe('ProjectName', () => {
    const defaultProps = {
        t,
        name: 'My Project',
        disabled: false,
        onProjectNameChange: vi.fn(),
    };

    it('shows project name in a div initially', () => {
        render(<ProjectName {...defaultProps} />);
        expect(screen.getByText('My Project')).toBeInTheDocument();
    });

    it('shows edit button with ✎ character initially', () => {
        render(<ProjectName {...defaultProps} />);
        expect(screen.getByTitle('menu_action_title_openEditMode')).toBeInTheDocument();
        expect(screen.getByTitle('menu_action_title_openEditMode')).toHaveTextContent('✎');
    });

    it('clicking edit button shows text input with current name', async () => {
        const user = userEvent.setup();
        render(<ProjectName {...defaultProps} />);
        await user.click(screen.getByTitle('menu_action_title_openEditMode'));
        const input = screen.getByRole('textbox');
        expect(input).toBeInTheDocument();
        expect((input as HTMLInputElement).value).toBe('My Project');
    });

    it('shows ✓ and ✕ buttons in edit mode', async () => {
        const user = userEvent.setup();
        render(<ProjectName {...defaultProps} />);
        await user.click(screen.getByTitle('menu_action_title_openEditMode'));
        expect(screen.getByTitle('menu_action_title_renameImage')).toBeInTheDocument();
        expect(screen.getByTitle('menu_action_title_closeEditMode')).toBeInTheDocument();
    });

    it('clicking cancel button reverts to showing name div', async () => {
        const user = userEvent.setup();
        render(<ProjectName {...defaultProps} />);
        await user.click(screen.getByTitle('menu_action_title_openEditMode'));
        await user.click(screen.getByTitle('menu_action_title_closeEditMode'));
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(screen.getByText('My Project')).toBeInTheDocument();
    });

    it('changing input and clicking confirm calls onProjectNameChange with trimmed value', async () => {
        const user = userEvent.setup();
        const onProjectNameChange = vi.fn();
        render(<ProjectName {...defaultProps} onProjectNameChange={onProjectNameChange} />);
        await user.click(screen.getByTitle('menu_action_title_openEditMode'));
        const input = screen.getByRole('textbox');
        await user.clear(input);
        await user.type(input, 'New Name');
        await user.click(screen.getByTitle('menu_action_title_renameImage'));
        expect(onProjectNameChange).toHaveBeenCalledWith('New Name');
    });

    it('confirm button is disabled when input is empty', async () => {
        const user = userEvent.setup();
        render(<ProjectName {...defaultProps} />);
        await user.click(screen.getByTitle('menu_action_title_openEditMode'));
        const input = screen.getByRole('textbox');
        await user.clear(input);
        expect(screen.getByTitle('menu_action_title_renameImage')).toBeDisabled();
    });

    it('confirm button is disabled when input is same as current name', async () => {
        const user = userEvent.setup();
        render(<ProjectName {...defaultProps} />);
        await user.click(screen.getByTitle('menu_action_title_openEditMode'));
        // Input starts with 'My Project' (same as name), so confirm is disabled
        expect(screen.getByTitle('menu_action_title_renameImage')).toBeDisabled();
    });

    it('pressing Escape in input closes edit mode', async () => {
        const user = userEvent.setup();
        render(<ProjectName {...defaultProps} />);
        await user.click(screen.getByTitle('menu_action_title_openEditMode'));
        const input = screen.getByRole('textbox');
        await user.type(input, '{Escape}');
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
});
