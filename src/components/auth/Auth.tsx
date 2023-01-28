import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { GlobalState } from '../../global/types';

import '../../global/actions/initial';
import { PLATFORM_ENV } from '../../util/environment';
import useHistoryBack from '../../hooks/useHistoryBack';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';

import Transition from '../ui/Transition';
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
    returnToAuthPhoneNumber, goToAuthQrCode,
  } = getActions();

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

  // For animation purposes
  const renderingAuthState = useCurrentOrPrev(
    authState !== 'authorizationStateReady' ? authState : undefined,
    true,
  );

  function getScreen() {
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
  }

  function getActiveKey() {
    switch (renderingAuthState) {
      case 'authorizationStateWaitCode':
        return 0;
      case 'authorizationStateWaitPassword':
        return 1;
      case 'authorizationStateWaitRegistration':
        return 2;
      case 'authorizationStateWaitPhoneNumber':
        return 3;
      case 'authorizationStateWaitQrCode':
        return 4;
      default:
        return isMobile ? 3 : 4;
    }
  }

  return (
    <Transition activeKey={getActiveKey()} name="fade" className="Auth">
      {getScreen()}
    </Transition>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    return {
      authState: global.authState,
    };
  },
)(Auth));
