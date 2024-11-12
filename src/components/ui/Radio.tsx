import type { ChangeEvent, MouseEventHandler } from 'react';
import type { FC, TeactNode } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import useOldLang from '../../hooks/useOldLang';

import Spinner from './Spinner';

import './Radio.scss';

type OwnProps = {
  id?: string;
  name?: string;
  label?: TeactNode;
  subLabel?: TeactNode;
  value?: string;
  checked?: boolean;
  disabled?: boolean;
  isLink?: boolean;
  hidden?: boolean;
  isLoading?: boolean;
  withIcon?: boolean;
  className?: string;
  onlyInput?: boolean;
  subLabelClassName?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onSubLabelClick?: MouseEventHandler<HTMLSpanElement> | undefined;
};

const Radio: FC<OwnProps> = ({
  id,
  label,
  subLabel,
  subLabelClassName,
  value,
  name,
  checked,
  disabled,
  hidden,
  isLoading,
  className,
  onlyInput,
  withIcon,
  isLink,
  onChange,
  onSubLabelClick,
}) => {
  const lang = useOldLang();
  const fullClassName = buildClassName(
    'Radio',
    className,
    disabled && 'disabled',
    hidden && 'hidden-widget',
    withIcon && 'with-icon',
    isLoading && 'loading',
    onlyInput && 'onlyInput',
  );

  return (
    <label className={fullClassName} dir={lang.isRtl ? 'rtl' : undefined}>
      <input
        type="radio"
        name={name}
        value={value}
        id={id}
        checked={checked}
        onChange={onChange}
        disabled={disabled || hidden}
      />
      <div className="Radio-main">
        <span className="label" dir={lang.isRtl ? 'auto' : undefined}>{label}</span>
        {subLabel
          && (
            <span
              className={buildClassName(subLabelClassName, 'subLabel', isLink ? 'subLabelLink' : undefined)}
              dir={lang.isRtl ? 'auto' : undefined}
              onClick={isLink ? onSubLabelClick : undefined}
            >
              {subLabel}
            </span>
          )}
      </div>
      {isLoading && <Spinner />}
    </label>
  );
};

export default memo(Radio);
