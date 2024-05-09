import type { ChangeEvent, MouseEventHandler } from 'react';
import type { FC, TeactNode } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import Spinner from './Spinner';

import './Radio.scss';

type OwnProps = {
  id?: string;
  name: string;
  label: TeactNode;
  subLabel?: string;
  value: string;
  checked: boolean;
  disabled?: boolean;
  isLink?: boolean;
  hidden?: boolean;
  isLoading?: boolean;
  className?: string;
  subLabelClassName?: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
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
  onChange,
  isLink,
  onSubLabelClick,
}) => {
  const lang = useLang();
  const fullClassName = buildClassName(
    'Radio',
    className,
    disabled && 'disabled',
    hidden && 'hidden-widget',
    isLoading && 'loading',
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
