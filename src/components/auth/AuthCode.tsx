import type { FormEvent } from 'react';
import type { FC } from '../../lib/teact/teact';
import {
  memo, useCallback, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { GlobalState } from '../../global/types';

import { IS_TOUCH_ENV } from '../../util/browser/windowEnvironment';
import { pick } from '../../util/iteratees';

import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';

import Icon from '../common/icons/Icon';
import TrackingMonkey from '../common/TrackingMonkey';
import InputText from '../ui/InputText';
import Loading from '../ui/Loading';

type StateProps = Pick<GlobalState, 'authPhoneNumber' | 'authIsCodeViaApp' | 'authIsLoading' | 'authErrorKey'>;

const CODE_LENGTH = 5;

const AuthCode: FC<StateProps> = ({
  authPhoneNumber,
  authIsCodeViaApp,
  authIsLoading,
  authErrorKey,
}) => {
  const {
    setAuthCode,
    returnToAuthPhoneNumber,
    clearAuthErrorKey,
  } = getActions();

  const lang = useLang();
  const inputRef = useRef<HTMLInputElement>();

  const [code, setCode] = useState<string>('');
  const [isTracking, setIsTracking] = useState(false);
  const [trackingDirection, setTrackingDirection] = useState(1);

  useEffect(() => {
    if (!IS_TOUCH_ENV) {
      inputRef.current!.focus();
    }
  }, []);

  useHistoryBack({
    isActive: true,
    onBack: returnToAuthPhoneNumber,
  });

  const onCodeChange = useCallback((e: FormEvent<HTMLInputElement>) => {
    if (authErrorKey) {
      clearAuthErrorKey();
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
  }, [authErrorKey, code, isTracking, setAuthCode]);

  function handleReturnToAuthPhoneNumber() {
    returnToAuthPhoneNumber();
  }

  return (
    <div id="auth-code-form" className="custom-scroll">
      <div className="auth-form">
        <TrackingMonkey
          code={code}
          codeLength={CODE_LENGTH}
          isTracking={isTracking}
          trackingDirection={trackingDirection}
        />
        <h1>
          {authPhoneNumber}
          <div
            className="auth-number-edit div-button"
            onClick={handleReturnToAuthPhoneNumber}
            role="button"
            tabIndex={0}
            title={lang('WrongNumber')}
            aria-label={lang('WrongNumber')}
          >
            <Icon name="edit" />
          </div>
        </h1>
        <p className="note">
          {lang(authIsCodeViaApp ? 'SentAppCode' : 'LoginJustSentSms', undefined, {
            withNodes: true,
            withMarkdown: true,
          })}
        </p>
        <InputText
          ref={inputRef}
          id="sign-in-code"
          label={lang('Code')}
          onInput={onCodeChange}
          value={code}
          error={authErrorKey && lang.withRegular(authErrorKey)}
          autoComplete="off"
          inputMode="numeric"
        />
        {authIsLoading && <Loading />}
      </div>
    </div>
  );
};

export default memo(withGlobal(
  (global): Complete<StateProps> => (
    pick(global, ['authPhoneNumber', 'authIsCodeViaApp', 'authIsLoading', 'authErrorKey']) as Complete<StateProps>
  ),
)(AuthCode));
