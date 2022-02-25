import React, {
  FC, memo, useCallback, useRef,
} from '../../lib/teact/teact';

import { formatCardExpiry } from '../middle/helpers/inputFormatters';

import InputText from '../ui/InputText';
import useLang from '../../hooks/useLang';

const MAX_FIELD_LENGTH = 5;

export type OwnProps = {
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

const ExpiryInput : FC<OwnProps> = ({ value, error, onChange }) => {
  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const expiryInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Backspace' && value.charAt(value.length - 1) === '/') {
      const newValue = value.slice(0, value.length - 1);
      if (expiryInputRef.current) {
        expiryInputRef.current.value = newValue;
      }
    }
  }, [value]);

  const handleChange = useCallback((e) => {
    onChange(formatCardExpiry(e.target.value));
  }, [onChange]);

  return (
    <InputText
      label={lang('PaymentCardExpireDate')}
      ref={expiryInputRef}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      value={value}
      error={error}
      inputMode="numeric"
      maxLength={MAX_FIELD_LENGTH}
    />
  );
};

export default memo(ExpiryInput);
