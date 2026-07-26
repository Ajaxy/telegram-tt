import {
  memo, useEffect, useRef,
} from '../../../lib/teact/teact';

import type { IconName } from '../../../types/icons';

import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { IS_TAURI } from '../../../util/browser/globalEnvironment';
import buildClassName from '../../../util/buildClassName';
import captureEscKeyListener from '../../../util/captureEscKeyListener';

import useLang from '../../../hooks/useLang';
import useScrollableHint from '../../../hooks/useScrollableHint';

import Button from '../Button';

import styles from './TextFormatter.module.scss';

type OwnProps = {
  value: string;
  placeholder: string;
  ariaLabel: string;
  isActive?: boolean;
  leadingButtonIconName?: IconName;
  leadingButtonAriaLabel?: string;
  canSubmitEmpty?: boolean;
  shouldSpellCheck?: boolean;
  inputMode?: 'text' | 'url';
  dir?: 'auto' | 'ltr' | 'rtl';
  onChange: (value: string) => void;
  onSubmit: NoneToVoidFunction;
  onEscape?: NoneToVoidFunction;
  onDeleteEmpty?: NoneToVoidFunction;
  onLeadingButtonClick?: NoneToVoidFunction;
};

const TextFormatterInput = ({
  value,
  placeholder,
  ariaLabel,
  isActive,
  leadingButtonIconName,
  leadingButtonAriaLabel,
  canSubmitEmpty,
  shouldSpellCheck,
  inputMode,
  dir,
  onChange,
  onSubmit,
  onEscape,
  onDeleteEmpty,
  onLeadingButtonClick,
}: OwnProps) => {
  const inputRef = useRef<HTMLInputElement>();
  const lang = useLang();
  const { updateScrollableHint } = useScrollableHint(inputRef, {
    isDisabled: !isActive,
    shouldSkipOverflowCheck: true,
  });

  const canSubmit = canSubmitEmpty || Boolean(value.trim().length);

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    requestMutation(() => {
      const input = inputRef.current!;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  }, [isActive]);

  useEffect(() => (
    isActive && onEscape ? captureEscKeyListener(onEscape) : undefined
  ), [isActive, onEscape]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.currentTarget.value);
    updateScrollableHint(e.currentTarget);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!value && onDeleteEmpty && (e.key === 'Backspace' || e.key === 'Delete')) {
      e.preventDefault();
      e.stopPropagation();
      onDeleteEmpty();
      return;
    }

    if (e.key !== 'Enter' || !canSubmit) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    onSubmit();
  }

  return (
    <div className={buildClassName(styles.buttons, styles.inputControl)} data-text-formatter>
      {leadingButtonIconName && leadingButtonAriaLabel && onLeadingButtonClick && (
        <>
          <Button
            color="translucent"
            ariaLabel={leadingButtonAriaLabel}
            onClick={onLeadingButtonClick}
            iconName={leadingButtonIconName}
          />
          <div className={styles.divider} />
        </>
      )}
      <div className={styles.inputWrapper}>
        <input
          ref={inputRef}
          className={buildClassName(styles.inputField, 'custom-scroll-x', 'no-scrollbar')}
          type="text"
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={shouldSpellCheck === false || IS_TAURI ? false : undefined}
          inputMode={inputMode}
          dir={dir}
          aria-label={ariaLabel}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </div>
      <div className={styles.inputConfirm}>
        <div className={styles.divider} />
        <Button
          color="translucent"
          ariaLabel={lang('Save')}
          className="color-primary"
          disabled={!canSubmit}
          onClick={onSubmit}
          iconName="check"
        />
      </div>
    </div>
  );
};

export default memo(TextFormatterInput);
