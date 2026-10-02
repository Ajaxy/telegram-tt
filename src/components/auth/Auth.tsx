import '../../global/actions/initial';

import { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { GlobalState } from '../../global/types';

import { IS_TAURI } from '../../util/browser/globalEnvironment';
import { IS_MAC_OS, PLATFORM_ENV } from '../../util/browser/windowEnvironment';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useFlag from '../../hooks/useFlag';
import useHistoryBack from '../../hooks/useHistoryBack';

import Transition from '../ui/Transition';
import AuthCode from './AuthCode.async';
import AuthPassword from './AuthPassword.async';
import AuthPhoneNumber from './AuthPhoneNumber';
import AuthQrCode from './AuthQrCode';
import AuthRegister from './AuthRegister.async';
import AuthSessionString from './AuthSessionString';

import './Auth.scss';

type StateProps = {
  authState: GlobalState['auth']['state'];
};

const Auth = ({
  authState,
}: StateProps) => {
  const {
    returnToAuthPhoneNumber, goToAuthQrCode,
  } = getActions();

  const isMobile = PLATFORM_ENV === 'iOS' || PLATFORM_ENV === 'Android';

  const [isSessionStringMode, markSessionStringMode, unmarkSessionStringMode] = useFlag();

  const handleChangeAuthorizationMethod = () => {
    if (!isMobile) {
      goToAuthQrCode();
    } else {
      returnToAuthPhoneNumber();
    }
  };

  useHistoryBack({
    isActive: isSessionStringMode
      || (!isMobile && authState === 'authorizationStateWaitPhoneNumber')
      || (isMobile && authState === 'authorizationStateWaitQrCode'),
    onBack: () => {
      if (isSessionStringMode) {
        unmarkSessionStringMode();
        return;
      }

      handleChangeAuthorizationMethod();
    },
  });

  // For animation purposes
  const renderingAuthState = useCurrentOrPrev(
    authState !== 'authorizationStateReady' ? authState : undefined,
    true,
  );

  function getScreen() {
    if (isSessionStringMode) {
      return <AuthSessionString onBack={unmarkSessionStringMode} />;
    }

    switch (renderingAuthState) {
      case 'authorizationStateWaitCode':
        return <AuthCode />;
      case 'authorizationStateWaitPassword':
        return <AuthPassword />;
      case 'authorizationStateWaitRegistration':
        return <AuthRegister />;
      case 'authorizationStateWaitPhoneNumber':
        return <AuthPhoneNumber onGoToSessionString={markSessionStringMode} />;
      case 'authorizationStateWaitQrCode':
        return <AuthQrCode onGoToSessionString={markSessionStringMode} />;
      default:
        return isMobile
          ? <AuthPhoneNumber onGoToSessionString={markSessionStringMode} />
          : <AuthQrCode onGoToSessionString={markSessionStringMode} />;
    }
  }

  function getActiveKey() {
    if (isSessionStringMode) {
      return 5;
    }

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
    <Transition
      activeKey={getActiveKey()}
      name="fade"
      className="Auth"
      data-tauri-drag-region={IS_TAURI && IS_MAC_OS ? true : undefined}
    >
      {getScreen()}
    </Transition>
  );
};

export default memo(withGlobal(
  (global): Complete<StateProps> => {
    return {
      authState: global.auth.state,
    };
  },
)(Auth));
