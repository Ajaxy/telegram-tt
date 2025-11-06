import type { ChangeEvent } from 'react';
import type { FC, TeactNode } from '../../lib/teact/teact';
import type React from '../../lib/teact/teact';
import {
  memo,
  useRef,
  useState,
} from '../../lib/teact/teact';

import type { ApiUser } from '../../api/types';
import type { IconName } from '../../types/icons';
import type { IRadioOption } from './CheckboxGroup';

import buildClassName from '../../util/buildClassName';
import { REM } from '../common/helpers/mediaDimensions';
import renderText from '../common/helpers/renderText';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Avatar from '../common/Avatar';
import Icon from '../common/icons/Icon';
import Button from './Button';
import Spinner from './Spinner';

import './Checkbox.scss';

type OwnProps = {
  id?: string;
  name?: string;
  value?: string;
  user?: ApiUser;
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
  nestedCheckbox?: boolean;
  nestedCheckboxCount?: number | undefined;
  nestedOptionList?: IRadioOption[];
  leftElement?: TeactNode;
  values?: string[];
  onChange?: (e: ChangeEvent<HTMLInputElement>, nestedOptionList?: IRadioOption[]) => void;
  onCheck?: (isChecked: boolean) => void;
  onClickLabel?: (e: React.MouseEvent, value?: string) => void;
};
const AVATAR_SIZE = 1.25 * REM;

const Checkbox: FC<OwnProps> = ({
  id,
  name,
  value,
  label,
  user,
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
  values,
  onChange,
  onCheck,
  onClickLabel,
}) => {
  const lang = useLang();
  const labelRef = useRef<HTMLLabelElement>();
  const [showNested, setShowNested] = useState(false);
  const renderingUser = useCurrentOrPrev(user, true);

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
          <div className={buildClassName('user-avatar', renderingUser && 'user-avatar-visible')}>
            {renderingUser && (
              <Avatar
                peer={renderingUser}
                size={AVATAR_SIZE}
              />
            )}
          </div>
          <span className="label" dir="auto">
            {leftElement}
            {typeof label === 'string' ? renderText(label) : label}
            {Boolean(labelText) && <span className="ml-1">{renderText(labelText)}</span>}
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
          {nestedOptionList?.map((nestedOption) => (
            <Checkbox
              key={nestedOption.value}
              leftElement={leftElement}
              onChange={handleChange}
              checked={values?.indexOf(nestedOption.value) !== -1}
              values={values}

              {...nestedOption}
            />
          ))}
        </div>
      )}
    </>
  );
};

export default memo(Checkbox);
