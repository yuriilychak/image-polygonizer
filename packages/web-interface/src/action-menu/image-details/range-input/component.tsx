import { FC, memo, ChangeEventHandler } from 'react';
import { useTranslation } from 'react-i18next';
import type { ImageConfigKey, SettingChangeCallback } from '../../../types';
import './component.css';

type RangeInputProps = {
    id: ImageConfigKey;
    min: number;
    max: number;
    value: number;
    disabled: boolean;
    onChange: SettingChangeCallback;
};

const RangeInput: FC<RangeInputProps> = ({ id, min, max, value, disabled, onChange }) => {
    const { t } = useTranslation();
    const label = t(`image_config_input_label_${id}`);
    const helpTitle = t(`image_config_input_help_${id}`);

    const handleChange: ChangeEventHandler<HTMLInputElement> = ({ currentTarget }) => 
        onChange(id, Number(currentTarget.value));

    return (
        <div className='range-input-root'>
            <div className='range-input-label'>
                <label className='range-input-label-text'>{label}</label>
                <span className='range-input-label-help' title={helpTitle}>?</span>
            </div>
            <div className='range-input-content'>
                <input disabled={disabled} id={id} type="range" min={min} max={max} value={value} step={1} className='range-input-handler' onChange={handleChange} />
                <span className='range-input-value'>{value}</span>
            </div>
        </div>
    );
}


export default memo(RangeInput);