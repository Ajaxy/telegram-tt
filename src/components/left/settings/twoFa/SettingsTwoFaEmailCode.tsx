import React, {
  FC, memo, useCallback, useEffect, useRef, useState,
} from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import { ApiSticker } from '../../../../api/types';
import { SettingsScreens } from '../../../../types';

import { IS_SINGLE_COLUMN_LAYOUT, IS_TOUCH_ENV } from '../../../../util/environment';
import { selectAnimatedEmoji } from '../../../../global/selectors';
import useLang from '../../../../hooks/useLang';
import useHistoryBack from '../../../../hooks/useHistoryBack';

import AnimatedEmoji from '../../../common/AnimatedEmoji';
import InputText from '../../../ui/InputText';
import Loading from '../../../ui/Loading';

type OwnProps = {
  isLoading?: boolean;
  error?: string;
  clearError: NoneToVoidFunction;
  onSubmit: (hint: string) => void;
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
  screen: SettingsScreens;
};

type StateProps = {
  animatedEmoji: ApiSticker;
  codeLength: number;
};

const FOCUS_DELAY_TIMEOUT_MS = IS_SINGLE_COLUMN_LAYOUT ? 550 : 400;

const SettingsTwoFaEmailCode: FC<OwnProps & StateProps> = ({
  animatedEmoji,
  codeLength,
  isLoading,
  error,
  clearError,
  onSubmit,
  isActive,
  onScreenSelect,
  onReset,
  screen,
}) => {
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState<string>('');

  useEffect(() => {
    if (!IS_TOUCH_ENV) {
      setTimeout(() => {
        inputRef.current!.focus();
      }, FOCUS_DELAY_TIMEOUT_MS);
    }
  }, []);

  const lang = useLang();

  useHistoryBack(isActive, onReset, onScreenSelect, screen);

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
      <div className="settings-content-header">
        <AnimatedEmoji sticker={animatedEmoji} size="large" />
      </div>

      <div className="settings-item pt-0 no-border">
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
  return {
    animatedEmoji: selectAnimatedEmoji(global, '💌'),
    codeLength: global.twoFaSettings.waitingEmailCodeLength,
  };
})(SettingsTwoFaEmailCode));
