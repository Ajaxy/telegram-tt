import type { FC } from '../../lib/teact/teact';
import React, { useEffect, memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { GlobalState } from '../../global/types';

import '../../global/actions/initial';
import { pick } from '../../util/iteratees';
import { PLATFORM_ENV } from '../../util/environment';
import windowSize from '../../util/windowSize';
import useHistoryBack from '../../hooks/useHistoryBack';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';

import AuthPhoneNumber from './AuthPhoneNumber';
import AuthCode from './AuthCode.async';
import AuthPassword from './AuthPassword.async';
import AuthRegister from './AuthRegister.async';
import AuthQrCode from './AuthQrCode';

import './Auth.scss';

type OwnProps = {
  isActive: boolean;
};

type StateProps = Pick<GlobalState, 'authState'>;

const Auth: FC<OwnProps & StateProps> = ({
  isActive, authState,
}) => {
  const {
    reset, initApi, returnToAuthPhoneNumber, goToAuthQrCode,
  } = getActions();

  useEffect(() => {
    if (isActive) {
      reset();
      initApi();
    }
  }, [isActive, reset, initApi]);

  const isMobile = PLATFORM_ENV === 'iOS' || PLATFORM_ENV === 'Android';

  const handleChangeAuthorizationMethod = () => {
    if (!isMobile) {
      goToAuthQrCode();
    } else {
      returnToAuthPhoneNumber();
    }
  };

  useHistoryBack({
    isActive: (!isMobile && authState === 'authorizationStateWaitPhoneNumber')
    || (isMobile && authState === 'authorizationStateWaitQrCode'),
    onBack: handleChangeAuthorizationMethod,
  });

  // Prevent refresh when rotating device
  useEffect(() => {
    windowSize.disableRefresh();

    return () => {
      windowSize.enableRefresh();
    };
  }, []);

  // For animation purposes
  const renderingAuthState = useCurrentOrPrev(
    authState !== 'authorizationStateReady' ? authState : undefined,
    true,
  );

  switch (renderingAuthState) {
    case 'authorizationStateWaitCode':
      return <AuthCode />;
    case 'authorizationStateWaitPassword':
      return <AuthPassword />;
    case 'authorizationStateWaitRegistration':
      return <AuthRegister />;
    case 'authorizationStateWaitPhoneNumber':
      return <AuthPhoneNumber />;
    case 'authorizationStateWaitQrCode':
      return <AuthQrCode />;
    default:
      return isMobile ? <AuthPhoneNumber /> : <AuthQrCode />;
  }
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => pick(global, ['authState']),
)(Auth));
