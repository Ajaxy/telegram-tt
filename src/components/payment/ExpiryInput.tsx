import type { FC } from '../../lib/teact/teact';
import React, { memo, useCallback } from '../../lib/teact/teact';

import { formatCardExpiry } from '../middle/helpers/inputFormatters';

import useOldLang from '../../hooks/useOldLang';

import InputText from '../ui/InputText';

const MAX_FIELD_LENGTH = 5;

export type OwnProps = {
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

const ExpiryInput : FC<OwnProps> = ({ value, error, onChange }) => {
  const lang = useOldLang();

  const handleChange = useCallback((e) => {
    const newValue = e.target.value;
    // Allow deleting separator
    if (value.endsWith('/') && value.length > newValue.length) {
      onChange(newValue);
    } else {
      onChange(formatCardExpiry(e.target.value));
    }
  }, [onChange, value]);

  return (
    <InputText
      label={lang('PaymentCardExpireDate')}
      onChange={handleChange}
      value={value}
      error={error}
      inputMode="numeric"
      tabIndex={0}
      maxLength={MAX_FIELD_LENGTH}
      teactExperimentControlled
    />
  );
};

export default memo(ExpiryInput);
