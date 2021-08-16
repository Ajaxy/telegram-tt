import { ChangeEvent, RefObject } from 'react';
import React, { FC, memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

type OwnProps = {
  id?: string;
  value?: string;
  label?: string;
  error?: string;
  ref?: RefObject<HTMLSelectElement>;
  hasArrow?: boolean;
  placeholder?: string;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  children: any;
};

const Select: FC<OwnProps> = (props) => {
  const {
    id,
    value,
    label,
    hasArrow,
    error,
    ref,
    placeholder,
    onChange,
    children,
  } = props;
  const labelText = error || label;
  const fullClassName = buildClassName(
    'input-group',
    value && 'touched',
    error && 'error',
    labelText && 'with-label',
    hasArrow && 'with-arrow',
    'input-group',
  );

  return (
    <div className={fullClassName}>
      <select
        className="form-control"
        id={id}
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder || label}
        ref={ref}
      >
        {children}
      </select>
      {labelText && id && (
        <label htmlFor={id}>{labelText}</label>
      )}
    </div>
  );
};

export default memo(Select);
