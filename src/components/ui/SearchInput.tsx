import type { MouseEvent as ReactMouseEvent } from 'react';
import type { ElementRef, FC } from '../../lib/teact/teact';
import {
  memo, useEffect, useRef,
} from '../../lib/teact/teact';

import { IS_TAURI } from '../../util/browser/globalEnvironment';
import buildClassName from '../../util/buildClassName';

import useFlag from '../../hooks/useFlag';
import useInputFocusOnOpen from '../../hooks/useInputFocusOnOpen';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import Icon from '../common/icons/Icon';
import Button from './Button';
import Loading from './Loading';
import Transition from './Transition';

import './SearchInput.scss';

type OwnProps = {
  ref?: ElementRef<HTMLInputElement>;
  children?: React.ReactNode;
  resultsItemSelector?: string;
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
  hasUpButton?: boolean;
  hasDownButton?: boolean;
  teactExperimentControlled?: boolean;
  withBackIcon?: boolean;
  onChange: (value: string) => void;
  onStartBackspace?: NoneToVoidFunction;
  onReset?: NoneToVoidFunction;
  onFocus?: NoneToVoidFunction;
  onBlur?: NoneToVoidFunction;
  onClick?: (e: ReactMouseEvent<HTMLDivElement, MouseEvent>) => void;
  onUpClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onDownClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onSpinnerClick?: NoneToVoidFunction;
  onEnter?: NoneToVoidFunction;
};

const SearchInput: FC<OwnProps> = ({
  ref,
  children,
  resultsItemSelector,
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
  hasUpButton,
  hasDownButton,
  teactExperimentControlled,
  withBackIcon,
  onChange,
  onStartBackspace,
  onReset,
  onFocus,
  onBlur,
  onClick,
  onUpClick,
  onDownClick,
  onSpinnerClick,
  onEnter,
}) => {
  let inputRef = useRef<HTMLInputElement>();
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

  const oldLang = useOldLang();
  const lang = useLang();

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { currentTarget } = event;
    onChange(currentTarget.value);

    if (!isInputFocused) {
      handleFocus();
    }
  }

  function handleFocus() {
    markInputFocused();
    onFocus?.();
  }

  function handleBlur() {
    unmarkInputFocused();
    onBlur?.();
  }

  const handleKeyDown = useLastCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (onEnter) {
        e.preventDefault();
        onEnter();
        return;
      }

      if (resultsItemSelector) {
        const element = document.querySelector(resultsItemSelector) as HTMLElement;
        if (element) {
          element.focus();
        }
      }
    }

    if (resultsItemSelector && e.key === 'ArrowDown') {
      const element = document.querySelector(resultsItemSelector) as HTMLElement;
      if (element) {
        element.focus();
      }
    }

    if (e.key === 'Backspace' && e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) {
      onStartBackspace?.();
    }
  });

  return (
    <div
      className={buildClassName('SearchInput', className, isInputFocused && 'has-focus')}
      onClick={onClick}
      dir={lang.isRtl ? 'rtl' : undefined}
    >
      <Transition
        name="fade"
        shouldCleanup
        activeKey={Number(!isLoading && !withBackIcon)}
        className="icon-container-left"
        slideClassName="icon-container-slide"
      >
        {isLoading && !withBackIcon ? (
          <Loading color={spinnerColor} backgroundColor={spinnerBackgroundColor} onClick={onSpinnerClick} />
        ) : withBackIcon ? (
          <Icon name="arrow-left" className="back-icon" onClick={onReset} />
        ) : (
          <Icon name="search" className="search-icon" />
        )}
      </Transition>
      <div>{children}</div>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        dir="auto"
        placeholder={placeholder || oldLang('Search')}
        className="form-control"
        value={value}
        disabled={disabled}
        autoComplete={autoComplete}
        spellCheck={IS_TAURI ? false : undefined}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        teactExperimentControlled={teactExperimentControlled}
      />
      {hasUpButton && (
        <Button
          round
          size="tiny"
          color="translucent"
          onClick={onUpClick}
          disabled={!onUpClick}
          ariaLabel={lang('AriaSearchOlderResult')}
        >
          <Icon name="up" />
        </Button>
      )}
      {hasDownButton && (
        <Button
          round
          size="tiny"
          color="translucent"
          onClick={onDownClick}
          disabled={!onDownClick}
          ariaLabel={lang('AriaSearchNewerResult')}
        >
          <Icon name="down" />
        </Button>
      )}
      <Transition
        name="fade"
        shouldCleanup
        activeKey={Number(isLoading)}
        className="icon-container-right"
        slideClassName="icon-container-slide"
      >
        {withBackIcon && isLoading ? (
          <Loading color={spinnerColor} backgroundColor={spinnerBackgroundColor} onClick={onSpinnerClick} />
        ) : (
          (value || canClose) && onReset && (
            <Button
              round
              size="tiny"
              color="translucent"
              onClick={onReset}
            >
              <Icon name="close" />
            </Button>
          )
        )}
      </Transition>
    </div>
  );
};

export default memo(SearchInput);
