import React, {
  FC, memo, useCallback, useEffect, useRef, useState,
} from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import { ApiSticker } from '../../../../api/types';

import { IS_SINGLE_COLUMN_LAYOUT, IS_TOUCH_ENV } from '../../../../util/environment';
import { selectAnimatedEmoji } from '../../../../global/selectors';
import useFlag from '../../../../hooks/useFlag';
import useLang from '../../../../hooks/useLang';
import useHistoryBack from '../../../../hooks/useHistoryBack';

import Button from '../../../ui/Button';
import Modal from '../../../ui/Modal';
import AnimatedEmoji from '../../../common/AnimatedEmoji';
import InputText from '../../../ui/InputText';
import renderText from '../../../common/helpers/renderText';

type OwnProps = {
  icon: 'hint' | 'email';
  type?: 'text' | 'email';
  isLoading?: boolean;
  error?: string;
  placeholder: string;
  shouldConfirm?: boolean;
  clearError?: NoneToVoidFunction;
  onSubmit: (value?: string) => void;
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  animatedEmoji: ApiSticker;
};

const FOCUS_DELAY_TIMEOUT_MS = IS_SINGLE_COLUMN_LAYOUT ? 550 : 400;

const SettingsTwoFaSkippableForm: FC<OwnProps & StateProps> = ({
  animatedEmoji,
  type = 'text',
  isLoading,
  error,
  placeholder,
  shouldConfirm,
  clearError,
  onSubmit,
  isActive,
  onReset,
}) => {
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState<string>('');
  const [isConfirmShown, markIsConfirmShown, unmarkIsConfirmShown] = useFlag(false);

  useEffect(() => {
    if (!IS_TOUCH_ENV) {
      setTimeout(() => {
        inputRef.current!.focus();
      }, FOCUS_DELAY_TIMEOUT_MS);
    }
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (error && clearError) {
      clearError();
    }

    setValue(e.target.value);
  }, [clearError, error]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!inputRef.current) {
      return;
    }

    onSubmit(value);
  };

  const handleSkip = useCallback(() => {
    onSubmit();
  }, [onSubmit]);

  const handleSkipConfirm = useCallback(() => {
    unmarkIsConfirmShown();
    onSubmit();
  }, [onSubmit, unmarkIsConfirmShown]);

  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  return (
    <div className="settings-content two-fa custom-scroll">
      <div className="settings-content-header no-border">
        <AnimatedEmoji sticker={animatedEmoji} size="large" />
      </div>

      <div className="settings-item pt-0">
        <form action="" onSubmit={handleSubmit}>
          <InputText
            ref={inputRef}
            value={value}
            inputMode={type}
            label={placeholder}
            error={error}
            onChange={handleInputChange}
          />

          {value ? (
            <Button type="submit" isLoading={isLoading} ripple>{lang('Continue')}</Button>
          ) : (
            <Button
              isText
              isLoading={isLoading}
              ripple
              onClick={shouldConfirm ? markIsConfirmShown : handleSkip}
            >
              {lang('YourEmailSkip')}
            </Button>
          )}
        </form>
        {shouldConfirm && (
          <Modal
            className="narrow"
            isOpen={isConfirmShown}
            title={lang('YourEmailSkipWarning')}
            onClose={unmarkIsConfirmShown}
          >
            {renderText(lang('YourEmailSkipWarningText'), ['br', 'simple_markdown'])}
            <div className="dialog-buttons">
              <Button
                color="danger"
                ripple
                isText
                className="confirm-dialog-button"
                onClick={handleSkipConfirm}
              >
                {lang('YourEmailSkip')}
              </Button>
              <Button
                color="primary"
                ripple
                isText
                className="confirm-dialog-button"
                onClick={unmarkIsConfirmShown}
              >
                {lang('Cancel')}
              </Button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>((global, { icon }) => {
  return {
    animatedEmoji: selectAnimatedEmoji(global, icon === 'email' ? '💌' : '💡'),
  };
})(SettingsTwoFaSkippableForm));
