import type { ChangeEvent } from 'react';
import type { FC, TeactNode } from '../../lib/teact/teact';
import React, {
  memo,
  useRef,
  useState,
} from '../../lib/teact/teact';

import type { IconName } from '../../types/icons';
import type { IRadioOption } from './CheckboxGroup';

import buildClassName from '../../util/buildClassName';
import renderText from '../common/helpers/renderText';

import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import Icon from '../common/icons/Icon';
import Button from './Button';
import Spinner from './Spinner';

import './Checkbox.scss';

type OwnProps = {
  id?: string;
  name?: string;
  value?: string;
  label?: TeactNode;
  labelText?: TeactNode;
  subLabel?: string;
  checked?: boolean;
  rightIcon?: IconName;
  disabled?: boolean;
  tabIndex?: number;
  withIcon?: boolean;
  blocking?: boolean;
  permissionGroup?: boolean;
  isLoading?: boolean;
  withCheckedCallback?: boolean;
  onlyInput?: boolean;
  isRound?: boolean;
  className?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>, nestedOptionList?: IRadioOption) => void;
  onCheck?: (isChecked: boolean) => void;
  onClickLabel?: (e: React.MouseEvent, value?: string) => void;
  nestedCheckbox?: boolean;
  nestedCheckboxCount?: number | undefined;
  nestedOptionList?: IRadioOption;
  leftElement?: TeactNode;
  values?: string[];
};

const Checkbox: FC<OwnProps> = ({
  id,
  name,
  value,
  label,
  labelText,
  subLabel,
  checked,
  tabIndex,
  disabled,
  withIcon,
  blocking,
  permissionGroup,
  isLoading,
  className,
  rightIcon,
  onlyInput,
  isRound,
  nestedCheckbox,
  nestedCheckboxCount,
  nestedOptionList,
  leftElement,
  values = [],
  onChange,
  onCheck,
  onClickLabel,
}) => {
  const lang = useOldLang();
  // eslint-disable-next-line no-null/no-null
  const labelRef = useRef<HTMLLabelElement>(null);
  const [showNested, setShowNested] = useState(false);

  const handleChange = useLastCallback((event: ChangeEvent<HTMLInputElement>) => {
    if (disabled) {
      return;
    }

    if (onChange) {
      onChange(event, nestedOptionList);
    }

    if (onCheck) {
      onCheck(event.currentTarget.checked);
    }
  });

  const toggleNested = useLastCallback(() => {
    setShowNested(!showNested);
  });

  function handleClick(event: React.MouseEvent) {
    if (event.target !== labelRef.current) {
      onClickLabel?.(event, value);
    }
  }

  function handleInputClick(event: React.MouseEvent) {
    event.stopPropagation();
  }

  const labelClassName = buildClassName(
    'Checkbox',
    disabled && 'disabled',
    withIcon && 'withIcon',
    isLoading && 'loading',
    blocking && 'blocking',
    nestedCheckbox && 'nested',
    subLabel && 'withSubLabel',
    permissionGroup && 'permission-group',
    Boolean(leftElement) && 'avatar',
    onlyInput && 'onlyInput',
    isRound && 'round',
    Boolean(rightIcon) && 'withNestedList',
    className,
  );

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <label
        className={labelClassName}
        dir={lang.isRtl ? 'rtl' : undefined}
        onClick={onClickLabel ? handleClick : undefined}
        ref={labelRef}
      >
        <input
          type="checkbox"
          id={id}
          name={name}
          value={value}
          checked={checked}
          disabled={disabled}
          tabIndex={tabIndex}
          onChange={handleChange}
          onClick={onClickLabel ? handleInputClick : undefined}
        />
        <div className={buildClassName(
          'Checkbox-main',
          Boolean(leftElement) && 'Nested-avatar-list',
        )}
        >
          <span className="label" dir="auto">
            {leftElement}
            {typeof label === 'string' ? renderText(label) : label}
            {labelText && <span className="ml-1">{renderText(labelText)}</span>}
          </span>
          {subLabel && <span className="subLabel" dir="auto">{renderText(subLabel)}</span>}
          {rightIcon && <Icon name={rightIcon} className="right-icon" />}
        </div>
        {nestedCheckbox && (
          <span className="nestedButton" dir="auto">
            <Button className="button" color="translucent" size="smaller" onClick={toggleNested}>
              <Icon name="group-filled" className="group-icon" />
              {nestedCheckboxCount}
              <Icon name={showNested ? 'up' : 'down'} />
            </Button>
          </span>
        )}
        {isLoading && <Spinner />}
      </label>
      {nestedCheckbox && (
        <div
          className={buildClassName('nested-checkbox-group', showNested && 'nested-checkbox-group-open')}
        >
          {nestedOptionList?.nestedOptions?.map((nestedOption) => (
            <Checkbox
              key={nestedOption.value}
              leftElement={leftElement}
              onChange={handleChange}
              checked={values.indexOf(nestedOption.value) !== -1}
              values={values}
              /* eslint-disable-next-line react/jsx-props-no-spreading */
              {...nestedOption}
            />
          ))}
        </div>
      )}
    </>
  );
};

export default memo(Checkbox);
