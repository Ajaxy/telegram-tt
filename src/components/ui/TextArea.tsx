import type { ChangeEvent, FormEvent, RefObject } from 'react';
import useLang from '../../hooks/useLang';
import buildClassName from '../../util/buildClassName';
import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useRef,
} from '../../lib/teact/teact';

type OwnProps = {
  ref?: RefObject<HTMLTextAreaElement>;
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
  tabIndex?: number;
  inputMode?: 'text' | 'none' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onInput?: (e: FormEvent<HTMLTextAreaElement>) => void;
  onKeyPress?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
};

const TextArea: FC<OwnProps> = ({
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
  tabIndex,
  onChange,
  onInput,
  onKeyPress,
  onKeyDown,
  onBlur,
  onPaste,
}) => {
  // eslint-disable-next-line no-null/no-null
  let textareaRef = useRef<HTMLTextAreaElement>(null);
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

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = '0';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    e.currentTarget.value = e.currentTarget.value.replace(/\n/, '');
    e.currentTarget.style.height = '0';
    e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
    onChange?.(e);
  }, [onChange]);

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
      {maxLengthIndicator && (
        <div className="max-length-indicator">{maxLengthIndicator}</div>
      )}
    </div>
  );
};

export default memo(TextArea);
