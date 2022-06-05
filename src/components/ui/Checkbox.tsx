import type { ChangeEvent } from 'react';
import type { FC, TeactNode } from '../../lib/teact/teact';
import React, { memo, useCallback } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';
import renderText from '../common/helpers/renderText';

import Spinner from './Spinner';

import './Checkbox.scss';

type OwnProps = {
  id?: string;
  name?: string;
  value?: string;
  label: TeactNode;
  subLabel?: string;
  checked: boolean;
  disabled?: boolean;
  tabIndex?: number;
  round?: boolean;
  blocking?: boolean;
  isLoading?: boolean;
  withCheckedCallback?: boolean;
  className?: string;
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
  tabIndex,
  disabled,
  round,
  blocking,
  isLoading,
  className,
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

  const labelClassName = buildClassName(
    'Checkbox',
    disabled && 'disabled',
    round && 'round',
    isLoading && 'loading',
    blocking && 'blocking',
    className,
  );

  return (
    <label className={labelClassName} dir={lang.isRtl ? 'rtl' : undefined}>
      <input
        type="checkbox"
        id={id}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        tabIndex={tabIndex}
        onChange={handleChange}
      />
      <div className="Checkbox-main">
        <span className="label" dir="auto">{typeof label === 'string' ? renderText(label) : label}</span>
        {subLabel && <span className="subLabel" dir="auto">{renderText(subLabel)}</span>}
      </div>
      {isLoading && <Spinner />}
    </label>
  );
};

export default memo(Checkbox);
