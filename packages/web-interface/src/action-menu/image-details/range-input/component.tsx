import { memo } from 'react';
import { RANGE_INPUT_STEP } from '../constants';

import type { FC, ChangeEventHandler } from 'react';
import type { TFunction } from 'i18next';
import type { ImageConfigKey, SettingChangeCallback } from '../../../types';

import './component.css';

type RangeInputProps = {
    t: TFunction;
    id: ImageConfigKey;
    min: number;
    max: number;
    value: number;
    disabled: boolean;
    onChange: SettingChangeCallback;
};

const RangeInput: FC<RangeInputProps> = ({ t, id, min, max, value, disabled, onChange }) => {
    const handleChange: ChangeEventHandler<HTMLInputElement> = ({ currentTarget }) =>
        onChange(id, Number(currentTarget.value));

    return (
        <div className="range-input-root">
            <div className="range-input-label">
                <label className="range-input-label-text">
                    {t(`image_config_input_label_${id}`)}
                </label>
                <span className="help-icon" title={t(`image_config_input_help_${id}`)}>
                    ?
                </span>
            </div>
            <div className="range-input-content">
                <input
                    disabled={disabled}
                    id={id}
                    type="range"
                    min={min}
                    max={max}
                    value={value}
                    step={RANGE_INPUT_STEP}
                    className="range-input-handler"
                    onChange={handleChange}
                />
                <span className="range-input-value">{value}</span>
            </div>
        </div>
    );
};

export default memo(RangeInput);
