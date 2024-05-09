import type { ChangeEvent } from 'react';
import type { FC, TeactNode } from '../../lib/teact/teact';
import React, { memo, useCallback } from '../../lib/teact/teact';

import useLastCallback from '../../hooks/useLastCallback';

import Radio from './Radio';

export type IRadioOption<T = string> = {
  label: TeactNode;
  subLabel?: string;
  value: T;
  hidden?: boolean;
  className?: string;
};

type OwnProps = {
  id?: string;
  name: string;
  options: IRadioOption[];
  selected?: string;
  disabled?: boolean;
  loadingOption?: string;
  onChange: (value: string, event: ChangeEvent<HTMLInputElement>) => void;
  onClickAction?: (value: string) => void;
  isLink?: boolean;
  subLabelClassName?: string;
  subLabel?: string | undefined;
};

const RadioGroup: FC<OwnProps> = ({
  id,
  name,
  options,
  selected,
  disabled,
  loadingOption,
  onChange,
  onClickAction,
  subLabelClassName,
  isLink,
  subLabel,
}) => {
  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.currentTarget;
    onChange(value, event);
  }, [onChange]);

  const onSubLabelClick = useLastCallback((value: string) => () => {
    onClickAction?.(value);
  });

  return (
    <div id={id} className="radio-group">
      {options.map((option) => (
        <Radio
          name={name}
          label={option.label}
          subLabel={subLabel || option.subLabel}
          subLabelClassName={subLabelClassName}
          value={option.value}
          checked={option.value === selected}
          hidden={option.hidden}
          disabled={disabled}
          isLoading={loadingOption ? loadingOption === option.value : undefined}
          className={option.className}
          onChange={handleChange}
          onSubLabelClick={onSubLabelClick(option.value)}
          isLink={isLink}
        />
      ))}
    </div>
  );
};

export default memo(RadioGroup);
