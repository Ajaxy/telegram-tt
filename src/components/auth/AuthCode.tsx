import { FormEvent } from 'react';
import React, {
  FC, useState, useEffect, useCallback, memo, useRef,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';
import { GlobalState, GlobalActions } from '../../global/types';

import { IS_TOUCH_ENV } from '../../util/environment';
import { pick } from '../../util/iteratees';

import InputText from '../ui/InputText';
import Loading from '../ui/Loading';
import TrackingMonkey from '../common/TrackingMonkey';
import useHistoryBack from '../../hooks/useHistoryBack';

type StateProps = Pick<GlobalState, 'authPhoneNumber' | 'authIsCodeViaApp' | 'authIsLoading' | 'authError'>;
type DispatchProps = Pick<GlobalActions, 'setAuthCode' | 'returnToAuthPhoneNumber' | 'clearAuthError'>;

const CODE_LENGTH = 5;

const AuthCode: FC<StateProps & DispatchProps> = ({
  authPhoneNumber, authIsCodeViaApp, authIsLoading, authError, setAuthCode, returnToAuthPhoneNumber, clearAuthError,
}) => {
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);

  const [code, setCode] = useState<string>('');
  const [isTracking, setIsTracking] = useState(false);
  const [trackingDirection, setTrackingDirection] = useState(1);

  useEffect(() => {
    if (!IS_TOUCH_ENV) {
      inputRef.current!.focus();
    }
  }, []);

  useHistoryBack(returnToAuthPhoneNumber);

  const onCodeChange = useCallback((e: FormEvent<HTMLInputElement>) => {
    if (authError) {
      clearAuthError();
    }

    const { currentTarget: target } = e;
    target.value = target.value.replace(/[^\d]+/, '').substr(0, CODE_LENGTH);

    if (target.value === code) {
      return;
    }

    setCode(target.value);

    if (!isTracking) {
      setIsTracking(true);
    } else if (!target.value.length) {
      setIsTracking(false);
    }

    if (code && code.length > target.value.length) {
      setTrackingDirection(-1);
    } else {
      setTrackingDirection(1);
    }

    if (target.value.length === CODE_LENGTH) {
      setAuthCode({ code: target.value });
    }
  }, [authError, clearAuthError, code, isTracking, setAuthCode]);

  return (
    <div id="auth-code-form" className="custom-scroll">
      <div className="auth-form">
        <TrackingMonkey
          code={code}
          codeLength={CODE_LENGTH}
          isTracking={isTracking}
          trackingDirection={trackingDirection}
        />
        <h2>
          {authPhoneNumber}
          <div
            className="auth-number-edit"
            onClick={returnToAuthPhoneNumber}
            role="button"
            tabIndex={0}
            title="Sign In with another phone number"
          >
            <i className="icon-edit" />
          </div>
        </h2>
        <p className="note">
          {authIsCodeViaApp ? (
            <>
              We have sent the code to the Telegram app
              <br />on your other device.
            </>
          ) : (
            <>
              We have sent you an SMS
              <br />with the code.
            </>
          )}
        </p>
        <InputText
          ref={inputRef}
          id="sign-in-code"
          label="Code"
          onInput={onCodeChange}
          value={code}
          error={authError}
          autoComplete="one-time-code"
          inputMode="decimal"
        />
        {authIsLoading && <Loading />}
      </div>
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => pick(global, ['authPhoneNumber', 'authIsCodeViaApp', 'authIsLoading', 'authError']),
  (setGlobal, actions): DispatchProps => pick(actions, ['setAuthCode', 'returnToAuthPhoneNumber', 'clearAuthError']),
)(AuthCode));
