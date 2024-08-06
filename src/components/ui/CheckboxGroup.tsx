import type { ChangeEvent } from 'react';
import type { FC, TeactNode } from '../../lib/teact/teact';
import React, { memo, useState } from '../../lib/teact/teact';

import type { ApiUser } from '../../api/types';

import useLastCallback from '../../hooks/useLastCallback';

import Checkbox from './Checkbox';

export type IRadioOption = {
  label: TeactNode;
  subLabel?: string;
  disabled?: boolean;
  value: string;
  nestedOptions?: IRadioOption[];
  user?: ApiUser;
};

type OwnProps = {
  id?: string;
  options: IRadioOption[];
  selected?: string[];
  disabled?: boolean;
  round?: boolean;
  nestedCheckbox?: boolean;
  loadingOptions?: string[];
  onChange: (value: string[]) => void;
};

const CheckboxGroup: FC<OwnProps> = ({
  id,
  options,
  selected = [],
  disabled,
  round,
  nestedCheckbox,
  loadingOptions,
  onChange,
}) => {
  const [values, setValues] = useState<string[]>(selected || []);

  const handleChange = useLastCallback((event: ChangeEvent<HTMLInputElement>, nestedOptionList?: IRadioOption) => {
    const { value, checked } = event.currentTarget;
    let newValues: string[];

    if (checked) {
      newValues = [...values, value];
      if (nestedOptionList && value) {
        newValues.push(nestedOptionList.value);
      }
      if (nestedOptionList && value === nestedOptionList.value) {
        nestedOptionList.nestedOptions?.forEach((nestedOption) => {
          if (!newValues.includes(nestedOption.value)) {
            newValues.push(nestedOption.value);
          }
        });
      }
    } else {
      newValues = values.filter((v) => v !== value);
      if (nestedOptionList && value === nestedOptionList.value) {
        nestedOptionList.nestedOptions?.forEach((nestedOption) => {
          newValues = newValues.filter((v) => v !== nestedOption.value);
        });
      } else if (nestedOptionList) {
        const nestedOptionValues = nestedOptionList.nestedOptions?.map((nestedOption) => nestedOption.value) || [];
        const hasOtherNestedValuesChecked = nestedOptionValues.some((nestedValue) => newValues.includes(nestedValue));
        if (!hasOtherNestedValuesChecked) {
          newValues = newValues.filter((v) => v !== nestedOptionList.value);
        }
      }
    }

    setValues(newValues);
    onChange(newValues);
  });
  const getCheckedNestedCount = useLastCallback((nestedOptions: IRadioOption[]) => {
    const checkedCount = nestedOptions?.filter((nestedOption) => values.includes(nestedOption.value)).length;
    return checkedCount > 0 ? checkedCount : undefined;
  });

  return (
    <div id={id} className="radio-group">
      {options.map((option) => {
        return (
          <Checkbox
            label={option.label}
            subLabel={option.subLabel}
            value={option.value}
            checked={selected.indexOf(option.value) !== -1}
            disabled={option.disabled || disabled}
            round={round}
            isLoading={loadingOptions ? loadingOptions.indexOf(option.value) !== -1 : undefined}
            onChange={handleChange}
            nestedCheckbox={nestedCheckbox}
            nestedCheckboxCount={getCheckedNestedCount(option.nestedOptions ?? [])}
            nestedOptionList={option}
            values={values}
          />
        );
      })}
    </div>
  );
};

export default memo(CheckboxGroup);
