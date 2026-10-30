import {
  memo, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { GlobalState } from '../../global/types';

import { IS_TOUCH_ENV } from '../../util/browser/windowEnvironment';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Button from '../ui/Button';
import TextArea from '../ui/TextArea';

type OwnProps = {
  onBack: NoneToVoidFunction;
};

type StateProps = {
  auth: GlobalState['auth'];
};

const AuthSessionString = ({
  auth,
  onBack,
}: OwnProps & StateProps) => {
  const { importAuthSessionString, clearAuthErrorKey } = getActions();

  const { isLoading, errorKey } = auth;

  const lang = useLang();
  const textAreaRef = useRef<HTMLTextAreaElement>();
  const [sessionString, setSessionString] = useState('');

  useEffect(() => {
    if (!IS_TOUCH_ENV) {
      textAreaRef.current?.focus();
    }
  }, []);

  const handleSessionStringChange = useLastCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (errorKey) {
      clearAuthErrorKey();
    }

    setSessionString(e.target.value);
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading || !sessionString.trim()) {
      return;
    }

    importAuthSessionString({ sessionString });
  }

  const handleBackToPhoneNumber = useLastCallback(() => {
    if (errorKey) {
      clearAuthErrorKey();
    }

    onBack();
  });

  const canSubmit = Boolean(sessionString.trim());

  return (
    <div id="auth-session-string-form" className="custom-scroll">
      <div className="auth-form">
        <h1>{lang('LoginSessionStringTitle')}</h1>
        <p className="note">{lang('LoginSessionStringDescription')}</p>
        <form className="form" action="" onSubmit={handleSubmit}>
          <TextArea
            ref={textAreaRef}
            id="sign-in-session-string"
            className="auth-session-string"
            label={lang('LoginSessionStringPlaceholder')}
            error={errorKey && lang.withRegular(errorKey)}
            value={sessionString}
            autoComplete="off"
            onChange={handleSessionStringChange}
          />
          {canSubmit && (
            <Button
              className="auth-button"
              type="submit"
              ripple
              isLoading={isLoading}
            >
              {lang('LoginSessionStringSubmit')}
            </Button>
          )}
          <Button
            className="auth-button"
            isText
            ripple
            onClick={handleBackToPhoneNumber}
          >
            {lang('LoginQRCancel')}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default memo(withGlobal(
  (global): Complete<StateProps> => {
    return {
      auth: global.auth,
    };
  },
)(AuthSessionString));
