import { memo } from 'react';
import { ID_TO_CHAR } from '../constants';

import type { FC } from 'react';
import type { TFunction } from 'i18next';


type WarningIconProps = {
    t: TFunction
    id: string;
};

const WarningIcon: FC<WarningIconProps> = ({ t, id }) => (
    <div className="warning-icon" title={t(`menu_action_title_${id}`)}>
        {ID_TO_CHAR[id]}
    </div>
);

export default memo(WarningIcon);