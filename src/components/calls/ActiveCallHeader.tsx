import { GroupCallParticipant } from '../../lib/secret-sauce';
import React, {
  FC, memo, useEffect,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { ApiGroupCall } from '../../api/types';

import { selectActiveGroupCall, selectGroupCallParticipant } from '../../global/selectors/calls';
import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';

import './ActiveCallHeader.scss';

type StateProps = {
  isGroupCallPanelHidden?: boolean;
  meParticipant: GroupCallParticipant;
  groupCall?: ApiGroupCall;
};

const ActiveCallHeader: FC<StateProps> = ({
  groupCall,
  meParticipant,
  isGroupCallPanelHidden,
}) => {
  const { toggleGroupCallPanel } = getActions();

  const lang = useLang();

  useEffect(() => {
    document.body.classList.toggle('has-group-call-header', isGroupCallPanelHidden);

    return () => {
      document.body.classList.toggle('has-group-call-header', false);
    };
  }, [isGroupCallPanelHidden]);

  if (!groupCall || !meParticipant) return undefined;

  return (
    <div
      className={buildClassName(
        'ActiveCallHeader',
        isGroupCallPanelHidden && 'open',
      )}
      onClick={toggleGroupCallPanel}
    >
      <span className="title">{groupCall.title || lang('VoipGroupVoiceChat')}</span>
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    return {
      groupCall: selectActiveGroupCall(global),
      isGroupCallPanelHidden: global.groupCalls.isGroupCallPanelHidden,
      meParticipant: selectGroupCallParticipant(global, global.groupCalls.activeGroupCallId!, global.currentUserId!),
    };
  },
)(ActiveCallHeader));
