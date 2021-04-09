import { ChangeEvent } from 'react';
import React, { FC, memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import Spinner from './Spinner';

import './Radio.scss';

type OwnProps = {
  id?: string;
  name: string;
  label: string;
  subLabel?: string;
  value: string;
  checked: boolean;
  disabled?: boolean;
  hidden?: boolean;
  isLoading?: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
};

const Radio: FC<OwnProps> = ({
  id,
  label,
  subLabel,
  value,
  name,
  checked,
  disabled,
  hidden,
  isLoading,
  onChange,
}) => {
  const className = buildClassName(
    'Radio',
    disabled && 'disabled',
    hidden && 'hidden-widget',
    isLoading && 'loading',
  );

  return (
    <label className={className}>
      <input
        type="radio"
        name={name}
        value={value}
        id={id}
        checked={checked}
        onChange={onChange}
        disabled={disabled || hidden}
      />
      <div className="Radio-main">
        <span className="label">{label}</span>
        {subLabel && <span className="subLabel">{subLabel}</span>}
      </div>
      {isLoading && <Spinner />}
    </label>
  );
};

export default memo(Radio);
