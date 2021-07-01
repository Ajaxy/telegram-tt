import React, { FC, useEffect, memo } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions, GlobalState } from '../../global/types';

import '../../modules/actions/initial';
import { pick } from '../../util/iteratees';

import UiLoader from '../common/UiLoader';
import AuthPhoneNumber from './AuthPhoneNumber';
import AuthCode from './AuthCode.async';
import AuthPassword from './AuthPassword.async';
import AuthRegister from './AuthRegister.async';
import AuthQrCode from './AuthQrCode';

import './Auth.scss';
import { PLATFORM_ENV } from '../../util/environment';

type StateProps = Pick<GlobalState, 'authState'>;
type DispatchProps = Pick<GlobalActions, 'reset' | 'initApi'>;

const Auth: FC<StateProps & DispatchProps> = ({ authState, reset, initApi }) => {
  useEffect(() => {
    reset();
    initApi();
  }, [reset, initApi]);

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
    default:
      return PLATFORM_ENV === 'iOS' || PLATFORM_ENV === 'Android'
        ? <UiLoader page="authPhoneNumber" key="authPhoneNumber"><AuthPhoneNumber /></UiLoader>
        : <UiLoader page="authQrCode" key="authQrCode"><AuthQrCode /></UiLoader>;
  }
};

export default memo(withGlobal(
  (global): StateProps => pick(global, ['authState']),
  (global, actions): DispatchProps => pick(actions, ['reset', 'initApi']),
)(Auth));
