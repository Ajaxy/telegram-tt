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
import AuthQrCode from './AuthQrCode.async';

import './Auth.scss';

type StateProps = Pick<GlobalState, 'authState'>;
type DispatchProps = Pick<GlobalActions, 'initApi'>;

const Auth: FC<StateProps & DispatchProps> = ({ authState, initApi }) => {
  useEffect(() => {
    initApi();
  }, [initApi]);

  switch (authState) {
    case 'authorizationStateWaitCode':
      return <UiLoader page="authCode" key="authCode"><AuthCode /></UiLoader>;
    case 'authorizationStateWaitPassword':
      return <UiLoader page="authPassword" key="authPassword"><AuthPassword /></UiLoader>;
    case 'authorizationStateWaitRegistration':
      return <AuthRegister />;
    case 'authorizationStateWaitQrCode':
      return <UiLoader page="authQrCode" key="authQrCode"><AuthQrCode /></UiLoader>;
    case 'authorizationStateWaitPhoneNumber':
    default:
      return <UiLoader page="authPhoneNumber" key="authPhoneNumber"><AuthPhoneNumber /></UiLoader>;
  }
};

export default memo(withGlobal(
  (global): StateProps => pick(global, ['authState']),
  (global, actions): DispatchProps => pick(actions, ['initApi']),
)(Auth));
