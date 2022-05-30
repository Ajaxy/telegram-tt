import type { FC } from '../../lib/teact/teact';
import React, { memo, useEffect } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiGroupCall, ApiUser } from '../../api/types';

import { selectActiveGroupCall, selectPhoneCallUser } from '../../global/selectors/calls';
import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';

import './ActiveCallHeader.scss';

type StateProps = {
  isCallPanelVisible?: boolean;
  groupCall?: ApiGroupCall;
  phoneCallUser?: ApiUser;
};

const ActiveCallHeader: FC<StateProps> = ({
  groupCall,
  phoneCallUser,
  isCallPanelVisible,
}) => {
  const { toggleGroupCallPanel } = getActions();

  const lang = useLang();

  useEffect(() => {
    document.body.classList.toggle('has-call-header', Boolean(isCallPanelVisible));

    return () => {
      document.body.classList.toggle('has-call-header', false);
    };
  }, [isCallPanelVisible]);

  if (!groupCall && !phoneCallUser) return undefined;

  return (
    <div
      className={buildClassName(
        'ActiveCallHeader',
        isCallPanelVisible && 'open',
      )}
      onClick={toggleGroupCallPanel}
    >
      <span className="title">{phoneCallUser?.firstName || groupCall?.title || lang('VoipGroupVoiceChat')}</span>
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    return {
      groupCall: selectActiveGroupCall(global),
      isCallPanelVisible: global.isCallPanelVisible,
      phoneCallUser: selectPhoneCallUser(global),
    };
  },
)(ActiveCallHeader));
