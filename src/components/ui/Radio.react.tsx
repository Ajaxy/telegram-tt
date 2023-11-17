import type { ChangeEvent } from 'react';
import React, { memo } from 'react';
import type { FC, TeactNode } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang.react';

import Spinner from './Spinner.react';

import './Radio.scss';

type OwnProps = {
  id?: string;
  name: string;
  label: TeactNode;
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
        <span className="label" dir={lang.isRtl ? 'auto' : undefined}>{label}</span>
        {subLabel && <span className="subLabel" dir={lang.isRtl ? 'auto' : undefined}>{subLabel}</span>}
      </div>
      {isLoading && <Spinner />}
    </label>
  );
};

export default memo(Radio);
