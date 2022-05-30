import type { ChangeEvent } from 'react';
import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useRef, useState,
} from '../../lib/teact/teact';

import { MIN_PASSWORD_LENGTH } from '../../config';
import { IS_TOUCH_ENV, IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';
import useTimeout from '../../hooks/useTimeout';

import Button from '../ui/Button';

type OwnProps = {
  submitLabel?: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  isLoading?: boolean;
  isPasswordVisible?: boolean;
  clearError: NoneToVoidFunction;
  onChangePasswordVisibility: (state: boolean) => void;
  onInputChange?: (password: string) => void;
  onSubmit: (password: string) => void;
};

const FOCUS_DELAY_TIMEOUT_MS = IS_SINGLE_COLUMN_LAYOUT ? 550 : 400;

const PasswordForm: FC<OwnProps> = ({
  isLoading = false,
  isPasswordVisible,
  error,
  hint,
  placeholder = 'Password',
  submitLabel = 'Next',
  clearError,
  onChangePasswordVisibility,
  onInputChange,
  onSubmit,
}) => {
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);
  const lang = useLang();

  const [password, setPassword] = useState('');
  const [canSubmit, setCanSubmit] = useState(false);

  useTimeout(() => {
    if (!IS_TOUCH_ENV) {
      inputRef.current!.focus();
    }
  }, FOCUS_DELAY_TIMEOUT_MS);

  useEffect(() => {
    if (error) {
      requestAnimationFrame(() => {
        inputRef.current!.focus();
        inputRef.current!.select();
      });
    }
  }, [error]);

  function onPasswordChange(e: ChangeEvent<HTMLInputElement>) {
    if (error) {
      clearError();
    }

    const { target } = e;
    setPassword(target.value);
    setCanSubmit(target.value.length >= MIN_PASSWORD_LENGTH);
    if (onInputChange) {
      onInputChange(target.value);
    }
  }

  function togglePasswordVisibility() {
    onChangePasswordVisibility(!isPasswordVisible);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    if (canSubmit) {
      onSubmit(password);
    }
  }

  return (
    <form action="" onSubmit={handleSubmit} autoComplete="off">
      <div
        className={buildClassName('input-group password-input', password && 'touched', error && 'error')}
        dir={lang.isRtl ? 'rtl' : undefined}
      >
        <input
          ref={inputRef}
          className="form-control"
          type={isPasswordVisible ? 'text' : 'password'}
          id="sign-in-password"
          value={password || ''}
          autoComplete="current-password"
          onChange={onPasswordChange}
          dir="auto"
        />
        <label>{error || hint || placeholder}</label>
        <div
          className="toggle-password"
          onClick={togglePasswordVisibility}
          role="button"
          tabIndex={0}
          title="Toggle password visibility"
        >
          <i className={isPasswordVisible ? 'icon-eye' : 'icon-eye-closed'} />
        </div>
      </div>
      {canSubmit && (
        <Button type="submit" ripple isLoading={isLoading}>
          {submitLabel}
        </Button>
      )}
    </form>
  );
};

export default memo(PasswordForm);
