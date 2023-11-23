import type { ChangeEvent } from 'react';
import React, { memo, useCallback, useState } from 'react';
import type { FC } from '../../lib/teact/teact';

import Checkbox from './Checkbox.react';

export type IRadioOption = {
  label: string;
  subLabel?: string;
  disabled?: boolean;
  value: string;
};

type OwnProps = {
  id?: string;
  options: IRadioOption[];
  selected?: string[];
  disabled?: boolean;
  round?: boolean;
  loadingOptions?: string[];
  onChange: (value: string[]) => void;
};

const CheckboxGroup: FC<OwnProps> = ({
  id,
  options,
  selected = [],
  disabled,
  round,
  loadingOptions,
  onChange,
}) => {
  const [values, setValues] = useState<string[]>(selected || []);

  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = event.currentTarget;
    let newValues: string[];
    if (checked) {
      newValues = [...values, value];
    } else {
      newValues = values.filter((v) => v !== value);
    }

    setValues(newValues);
    onChange(newValues);
  }, [onChange, values]);

  return (
    <div id={id} className="radio-group">
      {options.map((option) => (
        <Checkbox
          label={option.label}
          subLabel={option.subLabel}
          value={option.value}
          checked={selected.indexOf(option.value) !== -1}
          disabled={option.disabled || disabled}
          round={round}
          isLoading={loadingOptions ? loadingOptions.indexOf(option.value) !== -1 : undefined}
          onChange={handleChange}
        />
      ))}
    </div>
  );
};

export default memo(CheckboxGroup);
