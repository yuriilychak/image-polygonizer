import { useState, useEffect, memo } from 'react';
import { ActionButton } from '../shared';

import type { FC } from 'react';
import type { TFunction } from 'i18next';

import './component.css';

type ProjectNameProps = {
    t: TFunction;
    name: string;
    disabled: boolean;
    onProjectNameChange(newName: string): void;
};

const ProjectName: FC<ProjectNameProps> = ({ t, name, disabled, onProjectNameChange }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localName, setLocalName] = useState(name);
    const editActions = isEditing ? ['renameImage', 'closeEditMode'] : ['openEditMode'];
    const submitDisabled = localName.trim() === '' || localName === name;

    useEffect(() => {
        setLocalName(name);
    }, [name]);

    const onEditButtonClick = (action: string) => {
        switch (action) {
            case 'openEditMode':
                setIsEditing(true);
                break;
            case 'closeEditMode':
                setIsEditing(false);
                setLocalName(name);
                break;
            case 'renameImage':
                onProjectNameChange(localName.trim());
                setIsEditing(false);
                break;
            default:
                break;
        }
    };

    const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            setIsEditing(false);
        } else if (e.key === 'Escape') {
            setIsEditing(false);
            setLocalName(name);
        }
    };

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalName(e.target.value);
    };

    return (
        <div className="project-name-root">
            <span>{t('project_name_label')}:</span>
            {isEditing ? (
                <input
                    className="project-name-input"
                    type="text"
                    maxLength={32}
                    value={localName}
                    onKeyDown={onInputKeyDown}
                    onChange={onInputChange}
                />
            ) : (
                <div className="project-name-label">{name}</div>
            )}
            {editActions.map(action => (
                <ActionButton
                    key={action}
                    t={t}
                    action={action}
                    onAction={onEditButtonClick}
                    disabled={disabled || (action === 'renameImage' && submitDisabled)}
                />
            ))}
        </div>
    );
};

export default memo(ProjectName);
