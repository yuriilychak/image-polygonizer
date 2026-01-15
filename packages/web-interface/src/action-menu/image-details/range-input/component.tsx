import { FC } from 'react';
import './component.css';

type RangeInputProps = {
    id: string;
    label: string;
    title: string;
    min: number;
    max: number;
    value: number;
};

const RangeInput: FC<RangeInputProps> = ({ id, label, title, min, max, value }) => (
    <div className='range-input-root'>
        <div className='range-input-label'>
            <label className='range-input-label-text'>{label}</label>
            <span className='range-input-label-help' title={title}>?</span>
        </div>
        <div className='range-input-content'>
            <input id={id} type="range" min={min} max={max} value={value} step={1} className='range-input-handler' />
            <span className='range-input-value'>{value}</span>
        </div>
    </div>
);


export default RangeInput;