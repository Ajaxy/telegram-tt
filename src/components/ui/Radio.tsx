import { ChangeEvent } from 'react';
import React, { FC, memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';

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
  const lang = useLang();
  const className = buildClassName(
    'Radio',
    disabled && 'disabled',
    hidden && 'hidden-widget',
    isLoading && 'loading',
  );

  return (
    <label className={className} dir={lang.isRtl ? 'rtl' : undefined}>
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
        <span className="label" dir="auto">{label}</span>
        {subLabel && <span className="subLabel" dir="auto">{subLabel}</span>}
      </div>
      {isLoading && <Spinner />}
    </label>
  );
};

export default memo(Radio);
