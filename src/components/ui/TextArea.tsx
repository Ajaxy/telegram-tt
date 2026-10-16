import type { ElementRef } from '../../lib/teact/teact';
import {
  memo, useCallback, useLayoutEffect, useRef,
} from '../../lib/teact/teact';

import { requestForcedReflow, requestMutation } from '../../lib/fasterdom/fasterdom';
import { IS_TAURI } from '../../util/browser/globalEnvironment';
import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import AnimatedCounter from '../common/AnimatedCounter';

type OwnProps = {
  ref?: ElementRef<HTMLTextAreaElement>;
  id?: string;
  className?: string;
  value?: string;
  label?: string;
  error?: string;
  success?: string;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
  maxLengthIndicator?: string;
  hasLengthIndicator?: boolean;
  tabIndex?: number;
  inputMode?: 'text' | 'none' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onInput?: (e: React.FormEvent<HTMLTextAreaElement>) => void;
  onKeyPress?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  noReplaceNewlines?: boolean;
};

const TextArea = ({
  ref,
  id,
  className,
  value,
  label,
  error,
  success,
  disabled,
  readOnly,
  placeholder,
  autoComplete,
  inputMode,
  maxLength,
  maxLengthIndicator,
  hasLengthIndicator,
  tabIndex,
  onChange,
  onInput,
  onKeyPress,
  onKeyDown,
  onBlur,
  onPaste,
  noReplaceNewlines,
}: OwnProps) => {
  let textareaRef = useRef<HTMLTextAreaElement>();
  if (ref) {
    textareaRef = ref;
  }

  const lang = useLang();
  const labelText = error || success || label;
  const fullClassName = buildClassName(
    'input-group',
    value && 'touched',
    error ? 'error' : success && 'success',
    disabled && 'disabled',
    readOnly && 'disabled',
    labelText && 'with-label',
    className,
  );

  // Lets the effect below skip values already sized by typing
  const lastResizeValueRef = useRef<string>();

  const resizeHeight = useLastCallback((element: HTMLTextAreaElement) => {
    lastResizeValueRef.current = element.value;

    requestMutation(() => {
      element.style.height = '0';
      requestForcedReflow(() => {
        const newHeight = element.scrollHeight;
        return () => {
          element.style.height = `${newHeight}px`;
        };
      });
    });
  });

  // The height also follows values set from outside, not only user input
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || textarea.value === lastResizeValueRef.current) return;

    resizeHeight(textarea);
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    if (!noReplaceNewlines) {
      const previousSelectionEnd = target.selectionEnd;
      // TDesktop replaces newlines with spaces as well
      target.value = target.value.replace(/\n/g, ' ');
      target.selectionEnd = previousSelectionEnd;
    }
    resizeHeight(target);
    onChange?.(e);
  }, [noReplaceNewlines, onChange]);

  return (
    <div className={fullClassName} dir={lang.isRtl ? 'rtl' : undefined}>
      <textarea
        ref={textareaRef}
        className="form-control"
        id={id}
        dir="auto"
        value={value || ''}
        tabIndex={tabIndex}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        spellCheck={IS_TAURI ? false : undefined}
        inputMode={inputMode}
        disabled={disabled}
        readOnly={readOnly}
        onChange={handleChange}
        onInput={onInput}
        onKeyPress={onKeyPress}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        onPaste={onPaste}
        aria-label={labelText}
      />
      {labelText && (
        <label htmlFor={id}>{labelText}</label>
      )}
      {(maxLengthIndicator || (hasLengthIndicator && maxLength !== undefined)) && (
        <div className="max-length-indicator">
          <AnimatedCounter
            text={maxLengthIndicator || Math.max(0, maxLength! - (value || '').length).toString()}
          />
        </div>
      )}
    </div>
  );
};

export default memo(TextArea);
