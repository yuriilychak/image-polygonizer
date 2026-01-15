import { FC, ReactNode } from 'react';
import { MenuAction } from '../types';
import './component.css';

type MenuSectionProps = {
    title: string;
    children: ReactNode;
    className?: string;
    contentClassName?: string;
    actions?: MenuAction[];
};

const MenuSection: FC<MenuSectionProps> = ({ title, children, className = '', contentClassName = '', actions = [] }) => (
    <div className={`menu-section-root ${className}`}>
        <div className='menu-section-header'>
            <span className="menu-section-title">{title}</span>
            <div>
                {actions.map(action => (
                    <button key={action.id} className="char-button" title={action.title}>
                        {action.label}
                    </button>
                ))}
            </div>
        </div>
        <div className={`menu-section-content ${contentClassName}`}>
            {children}
        </div>
        <div className='menu-section-divider'/>
    </div>
);

export default MenuSection;