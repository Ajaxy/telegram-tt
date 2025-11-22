import type { ChangeEvent } from 'react';
import type { FC, TeactNode } from '../../lib/teact/teact';
import { memo } from '../../lib/teact/teact';

import type { ApiPeer } from '../../api/types';

import buildClassName from '../../util/buildClassName';
import { unique } from '../../util/iteratees';

import useLastCallback from '../../hooks/useLastCallback';

import Checkbox from './Checkbox';

export type IRadioOption = {
  label: TeactNode;
  subLabel?: string;
  disabled?: boolean;
  value: string;
  nestedOptions?: IRadioOption[];
  peer?: ApiPeer;
};

type OwnProps = {
  id?: string;
  options: IRadioOption[];
  selected: string[];
  disabled?: boolean;
  nestedCheckbox?: boolean;
  loadingOptions?: string[];
  isRound?: boolean;
  onChange: (value: string[]) => void;
  onClickLabel?: (e: React.MouseEvent, value?: string) => void;
  className?: string;
};

const CheckboxGroup: FC<OwnProps> = ({
  id,
  options,
  selected,
  disabled,
  nestedCheckbox,
  loadingOptions,
  isRound,
  onChange,
  onClickLabel,
  className,
}) => {
  const handleChange = useLastCallback((event: ChangeEvent<HTMLInputElement>, nestedOptionList?: IRadioOption[]) => {
    const { value, checked } = event.currentTarget;
    let newValues: string[];

    if (checked) {
      newValues = unique([...selected, value]);
      nestedOptionList?.forEach((nestedOption) => {
        if (!newValues.includes(nestedOption.value)) {
          newValues.push(nestedOption.value);
        }
      });
    } else {
      newValues = selected.filter((v) => v !== value);
      if (nestedOptionList) {
        newValues = newValues.filter((v) => !nestedOptionList.some((nestedOption) => nestedOption.value === v));
      }
    }
    onChange(newValues);
  });
  const getCheckedNestedCount = useLastCallback((nestedOptions: IRadioOption[]) => {
    const checkedCount = nestedOptions?.filter((nestedOption) => selected.includes(nestedOption.value)).length;
    return checkedCount > 0 ? checkedCount : nestedOptions.length;
  });

  return (
    <div id={id} className={buildClassName('radio-group', className)}>
      {options.map((option) => {
        return (
          <Checkbox
            label={option.label}
            subLabel={option.subLabel}
            value={option.value}
            peer={option.peer}
            checked={selected?.indexOf(option.value) !== -1}
            disabled={option.disabled || disabled}
            isLoading={loadingOptions ? loadingOptions.indexOf(option.value) !== -1 : undefined}
            onChange={handleChange}
            onClickLabel={onClickLabel}
            nestedCheckbox={nestedCheckbox}
            nestedCheckboxCount={getCheckedNestedCount(option.nestedOptions ?? [])}
            nestedOptionList={option.nestedOptions}
            values={selected}
            isRound={isRound}
          />
        );
      })}
    </div>
  );
};

export default memo(CheckboxGroup);
