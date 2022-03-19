import React, { FC, useEffect, memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../modules';

import { GlobalState } from '../../global/types';

import '../../modules/actions/initial';
import { pick } from '../../util/iteratees';
import { PLATFORM_ENV } from '../../util/environment';
import windowSize from '../../util/windowSize';
import useHistoryBack from '../../hooks/useHistoryBack';

import UiLoader from '../common/UiLoader';
import AuthPhoneNumber from './AuthPhoneNumber';
import AuthCode from './AuthCode.async';
import AuthPassword from './AuthPassword.async';
import AuthRegister from './AuthRegister.async';
import AuthQrCode from './AuthQrCode';

import './Auth.scss';

type StateProps = Pick<GlobalState, 'authState'>;

const Auth: FC<StateProps> = ({
  authState,
}) => {
  const {
    reset, initApi, returnToAuthPhoneNumber, goToAuthQrCode,
  } = getActions();

  useEffect(() => {
    reset();
    initApi();
  }, [reset, initApi]);

  const isMobile = PLATFORM_ENV === 'iOS' || PLATFORM_ENV === 'Android';

  const handleChangeAuthorizationMethod = () => {
    if (!isMobile) {
      goToAuthQrCode();
    } else {
      returnToAuthPhoneNumber();
    }
  };

  useHistoryBack(
    (!isMobile && authState === 'authorizationStateWaitPhoneNumber')
    || (isMobile && authState === 'authorizationStateWaitQrCode'), handleChangeAuthorizationMethod,
  );

  // Prevent refresh when rotating device
  useEffect(() => {
    windowSize.disableRefresh();

    return () => {
      windowSize.enableRefresh();
    };
  }, []);

  switch (authState) {
    case 'authorizationStateWaitCode':
      return <UiLoader page="authCode" key="authCode"><AuthCode /></UiLoader>;
    case 'authorizationStateWaitPassword':
      return <UiLoader page="authPassword" key="authPassword"><AuthPassword /></UiLoader>;
    case 'authorizationStateWaitRegistration':
      return <AuthRegister />;
    case 'authorizationStateWaitPhoneNumber':
      return <UiLoader page="authPhoneNumber" key="authPhoneNumber"><AuthPhoneNumber /></UiLoader>;
    case 'authorizationStateWaitQrCode':
      return <UiLoader page="authQrCode" key="authQrCode"><AuthQrCode /></UiLoader>;
    default:
      return isMobile
        ? <UiLoader page="authPhoneNumber" key="authPhoneNumber"><AuthPhoneNumber /></UiLoader>
        : <UiLoader page="authQrCode" key="authQrCode"><AuthQrCode /></UiLoader>;
  }
};

export default memo(withGlobal(
  (global): StateProps => pick(global, ['authState']),
)(Auth));
