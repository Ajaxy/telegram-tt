import type { ChangeEvent } from 'react';
import type { ElementRef } from '../../lib/teact/teact';
import type React from '../../lib/teact/teact';
import { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

type OwnProps = {
  id?: string;
  value?: string;
  label?: string;
  error?: string;
  ref?: ElementRef<HTMLSelectElement>;
  hasArrow?: boolean;
  tabIndex?: number;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
};

const Select = (props: OwnProps) => {
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
