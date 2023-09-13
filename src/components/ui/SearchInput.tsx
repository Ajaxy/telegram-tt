import type { RefObject } from 'react';
import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useRef,
} from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import useFlag from '../../hooks/useFlag';
import useInputFocusOnOpen from '../../hooks/useInputFocusOnOpen';
import useLang from '../../hooks/useLang';

import Button from './Button';
import Loading from './Loading';
import Transition from './Transition';

import './SearchInput.scss';

type OwnProps = {
  ref?: RefObject<HTMLInputElement>;
  children?: React.ReactNode;
  parentContainerClassName?: string;
  className?: string;
  inputId?: string;
  value?: string;
  focused?: boolean;
  isLoading?: boolean;
  spinnerColor?: 'yellow';
  spinnerBackgroundColor?: 'light';
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
  canClose?: boolean;
  autoFocusSearch?: boolean;
  onChange: (value: string) => void;
  onReset?: NoneToVoidFunction;
  onFocus?: NoneToVoidFunction;
  onBlur?: NoneToVoidFunction;
  onSpinnerClick?: NoneToVoidFunction;
};

const SearchInput: FC<OwnProps> = ({
  ref,
  children,
  parentContainerClassName,
  value,
  inputId,
  className,
  focused,
  isLoading = false,
  spinnerColor,
  spinnerBackgroundColor,
  placeholder,
  disabled,
  autoComplete,
  canClose,
  autoFocusSearch,
  onChange,
  onReset,
  onFocus,
  onBlur,
  onSpinnerClick,
}) => {
  // eslint-disable-next-line no-null/no-null
  let inputRef = useRef<HTMLInputElement>(null);
  if (ref) {
    inputRef = ref;
  }

  const [isInputFocused, markInputFocused, unmarkInputFocused] = useFlag(focused);

  useInputFocusOnOpen(inputRef, autoFocusSearch, unmarkInputFocused);

  useEffect(() => {
    if (!inputRef.current) {
      return;
    }

    if (focused) {
      inputRef.current.focus();
    } else {
      inputRef.current.blur();
    }
  }, [focused, placeholder]); // Trick for setting focus when selecting a contact to search for

  const lang = useLang();

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { currentTarget } = event;
    onChange(currentTarget.value);
  }

  function handleFocus() {
    markInputFocused();
    if (onFocus) {
      onFocus();
    }
  }

  function handleBlur() {
    unmarkInputFocused();
    if (onBlur) {
      onBlur();
    }
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      const element = document.querySelector(`.${parentContainerClassName} .ListItem-button`) as HTMLElement;
      if (element) {
        element.focus();
      }
    }
  }, [parentContainerClassName]);

  return (
    <div
      className={buildClassName('SearchInput', className, isInputFocused && 'has-focus')}
      dir={lang.isRtl ? 'rtl' : undefined}
    >
      {children}
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        dir="auto"
        placeholder={placeholder || lang('Search')}
        className="form-control"
        value={value}
        disabled={disabled}
        autoComplete={autoComplete}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      <Transition
        name="fade"
        shouldCleanup
        activeKey={Number(isLoading)}
        className="icon-container"
      >
        {isLoading ? (
          <Loading color={spinnerColor} backgroundColor={spinnerBackgroundColor} onClick={onSpinnerClick} />
        ) : (
          <i className="icon icon-search search-icon" />
        )}
      </Transition>
      {!isLoading && (value || canClose) && onReset && (
        <Button
          round
          size="tiny"
          color="translucent"
          onClick={onReset}
        >
          <span className="icon icon-close" />
        </Button>
      )}
    </div>
  );
};

export default memo(SearchInput);
