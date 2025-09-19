import type { FC } from '../../lib/teact/teact';
import { memo, useEffect } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiGroupCall, ApiUser } from '../../api/types';

import { selectTabState } from '../../global/selectors';
import { selectActiveGroupCall, selectPhoneCallUser } from '../../global/selectors/calls';
import buildClassName from '../../util/buildClassName';

import useOldLang from '../../hooks/useOldLang';

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

  const lang = useOldLang();

  useEffect(() => {
    document.body.classList.toggle('has-call-header', Boolean(isCallPanelVisible));
    window.tauri?.markTitleBarOverlay(!isCallPanelVisible);

    return () => {
      document.body.classList.toggle('has-call-header', false);
      window.tauri?.markTitleBarOverlay(true);
    };
  }, [isCallPanelVisible]);

  function handleToggleGroupCallPanel() {
    toggleGroupCallPanel();
  }

  if (!groupCall && !phoneCallUser) return undefined;

  return (
    <div
      className={buildClassName(
        'ActiveCallHeader',
        isCallPanelVisible && 'open',
      )}
      onClick={handleToggleGroupCallPanel}
    >
      <span className="title">{phoneCallUser?.firstName || groupCall?.title || lang('VoipGroupVoiceChat')}</span>
    </div>
  );
};

export default memo(withGlobal(
  (global): Complete<StateProps> => {
    const tabState = selectTabState(global);
    return {
      groupCall: tabState.isMasterTab ? selectActiveGroupCall(global) : undefined,
      isCallPanelVisible: tabState.isCallPanelVisible,
      phoneCallUser: tabState.isMasterTab ? selectPhoneCallUser(global) : undefined,
    };
  },
)(ActiveCallHeader));
