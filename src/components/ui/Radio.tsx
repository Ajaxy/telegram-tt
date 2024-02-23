import type { ChangeEvent } from 'react';
import type { FC, TeactNode } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import Spinner from './Spinner';

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
  className?: string;
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
  className,
  onChange,
}) => {
  const lang = useLang();
  const fullClassName = buildClassName(
    'Radio',
    className,
    disabled && 'disabled',
    hidden && 'hidden-widget',
    isLoading && 'loading',
  );

  return (
    <label className={fullClassName} dir={lang.isRtl ? 'rtl' : undefined}>
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
