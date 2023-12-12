import type { ChangeEvent, RefObject } from 'react';
import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

type OwnProps = {
  id?: string;
  value?: string;
  label?: string;
  error?: string;
  ref?: RefObject<HTMLSelectElement>;
  hasArrow?: boolean;
  tabIndex?: number;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
};

const Select: FC<OwnProps> = (props) => {
  const {
    id,
    value,
    label,
    hasArrow,
    error,
    ref,
    tabIndex,
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
        tabIndex={tabIndex}
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
