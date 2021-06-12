import { ChangeEvent } from 'react';
import React, { FC, memo, useCallback } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';

import Spinner from './Spinner';

import './Checkbox.scss';

type OwnProps = {
  id?: string;
  name?: string;
  value?: string;
  label: string;
  subLabel?: string;
  checked: boolean;
  disabled?: boolean;
  round?: boolean;
  blocking?: boolean;
  isLoading?: boolean;
  withCheckedCallback?: boolean;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onCheck?: (isChecked: boolean) => void;
};

const Checkbox: FC<OwnProps> = ({
  id,
  name,
  value,
  label,
  subLabel,
  checked,
  disabled,
  round,
  blocking,
  isLoading,
  onChange,
  onCheck,
}) => {
  const lang = useLang();
  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(event);
    }

    if (onCheck) {
      onCheck(event.currentTarget.checked);
    }
  }, [onChange, onCheck]);

  const className = buildClassName(
    'Checkbox',
    disabled && 'disabled',
    round && 'round',
    isLoading && 'loading',
    blocking && 'blocking',
  );

  return (
    <label className={className} dir={lang.isRtl ? 'rtl' : undefined}>
      <input
        type="checkbox"
        id={id}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={handleChange}
      />
      <div className="Checkbox-main">
        <span className="label" dir="auto">{label}</span>
        {subLabel && <span className="subLabel" dir="auto">{subLabel}</span>}
      </div>
      {isLoading && <Spinner />}
    </label>
  );
};

export default memo(Checkbox);
