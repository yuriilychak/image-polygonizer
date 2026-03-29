import { render, screen } from '@testing-library/react';
import WarningIcon from '../component';

const t = (key: string) => key;

describe('WarningIcon', () => {
    it('renders with className "warning-icon"', () => {
        const { container } = render(<WarningIcon t={t} id="polygonsOutdated" />);
        expect(container.querySelector('.warning-icon')).toBeInTheDocument();
    });

    it('has title attribute equal to menu_action_title_${id}', () => {
        render(<WarningIcon t={t} id="polygonsOutdated" />);
        expect(screen.getByTitle('menu_action_title_polygonsOutdated')).toBeInTheDocument();
    });

    it('renders ﹡ character for polygonsOutdated', () => {
        render(<WarningIcon t={t} id="polygonsOutdated" />);
        expect(screen.getByTitle('menu_action_title_polygonsOutdated')).toHaveTextContent('﹡');
    });

    it('renders ! character for polygonsMissing', () => {
        render(<WarningIcon t={t} id="polygonsMissing" />);
        expect(screen.getByTitle('menu_action_title_polygonsMissing')).toHaveTextContent('!');
    });
});
