import { ChangeEvent } from 'react';
import React, { FC, memo, useCallback } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import './Switcher.scss';

type OwnProps = {
  id?: string;
  name?: string;
  value?: string;
  label: string;
  checked?: boolean;
  disabled?: boolean;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onCheck?: (isChecked: boolean) => void;
};

const Switcher: FC<OwnProps> = ({
  id,
  name,
  value,
  label,
  checked = false,
  disabled,
  onChange,
  onCheck,
}) => {
  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(event);
    }

    if (onCheck) {
      onCheck(event.currentTarget.checked);
    }
  }, [onChange, onCheck]);

  const className = buildClassName(
    'Switcher',
    disabled && 'disabled',
  );

  return (
    <label className={className} title={label}>
      <input
        type="checkbox"
        id={id}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={handleChange}
      />
      <span className="widget" />
    </label>
  );
};

export default memo(Switcher);
