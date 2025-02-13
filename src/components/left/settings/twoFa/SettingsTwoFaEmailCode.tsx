import type { FC } from '../../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useRef, useState,
} from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { ApiSticker } from '../../../../api/types';

import { selectAnimatedEmoji, selectTabState } from '../../../../global/selectors';
import { IS_TOUCH_ENV } from '../../../../util/windowEnvironment';

import useAppLayout from '../../../../hooks/useAppLayout';
import useHistoryBack from '../../../../hooks/useHistoryBack';
import useOldLang from '../../../../hooks/useOldLang';

import AnimatedIconFromSticker from '../../../common/AnimatedIconFromSticker';
import InputText from '../../../ui/InputText';
import Loading from '../../../ui/Loading';

type OwnProps = {
  isLoading?: boolean;
  error?: string;
  clearError: NoneToVoidFunction;
  onSubmit: (hint: string) => void;
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  animatedEmoji: ApiSticker;
  codeLength: number;
  recoveryEmail: string;
};

const ICON_SIZE = 160;

const SettingsTwoFaEmailCode: FC<OwnProps & StateProps> = ({
  animatedEmoji,
  codeLength,
  isLoading,
  error,
  clearError,
  onSubmit,
  isActive,
  onReset,
  recoveryEmail,
}) => {
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);
  const { isMobile } = useAppLayout();
  const focusDelayTimeoutMs = isMobile ? 550 : 400;

  const [value, setValue] = useState<string>('');

  useEffect(() => {
    if (!IS_TOUCH_ENV) {
      setTimeout(() => {
        inputRef.current!.focus();
      }, focusDelayTimeoutMs);
    }
  }, [focusDelayTimeoutMs]);

  const lang = useOldLang();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (error && clearError) {
      clearError();
    }

    const newValue = e.target.value.slice(0, codeLength);

    if (newValue.length === codeLength) {
      onSubmit(newValue);
    }

    setValue(newValue);
    e.target.value = newValue;
  }, [clearError, codeLength, error, onSubmit]);

  return (
    <div className="settings-content two-fa custom-scroll">
      <div className="settings-content-header no-border">
        <AnimatedIconFromSticker sticker={animatedEmoji} size={ICON_SIZE} className="settings-content-icon" />
        <p className="settings-item-description mb-3" dir="auto">
          {lang('TwoStepAuth.ConfirmEmailDescription', recoveryEmail)}
        </p>
      </div>

      <div className="settings-item pt-2">
        <InputText
          value={value}
          ref={inputRef}
          inputMode="decimal"
          label={lang('YourEmailCode')}
          error={error}
          onChange={handleInputChange}
        />
        {isLoading && <Loading />}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>((global) => {
  const tabState = selectTabState(global);
  const recoveryEmail = tabState.recoveryEmail;

  return {
    animatedEmoji: selectAnimatedEmoji(global, '💌'),
    codeLength: global.twoFaSettings.waitingEmailCodeLength,
    recoveryEmail,
  };
})(SettingsTwoFaEmailCode));
