import type { ChangeEvent } from 'react';
import React, { memo, useCallback } from 'react';
import type { FC, TeactNode } from '../../lib/teact/teact';

import Radio from './Radio.react';

export type IRadioOption = {
  label: TeactNode;
  subLabel?: string;
  value: string;
  hidden?: boolean;
};

type OwnProps = {
  id?: string;
  name: string;
  options: IRadioOption[];
  selected?: string;
  disabled?: boolean;
  loadingOption?: string;
  onChange: (value: string, event: ChangeEvent<HTMLInputElement>) => void;
};

const RadioGroup: FC<OwnProps> = ({
  id,
  name,
  options,
  selected,
  disabled,
  loadingOption,
  onChange,
}) => {
  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.currentTarget;
    onChange(value, event);
  }, [onChange]);

  return (
    <div id={id} className="radio-group">
      {options.map((option) => (
        <Radio
          name={name}
          label={option.label}
          subLabel={option.subLabel}
          value={option.value}
          checked={option.value === selected}
          hidden={option.hidden}
          disabled={disabled}
          isLoading={loadingOption ? loadingOption === option.value : undefined}
          onChange={handleChange}
        />
      ))}
    </div>
  );
};

export default memo(RadioGroup);
