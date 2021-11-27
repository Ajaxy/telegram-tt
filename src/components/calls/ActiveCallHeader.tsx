import { GroupCallParticipant } from '../../lib/secret-sauce';
import React, {
  FC, memo, useEffect,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';
import { ApiGroupCall } from '../../api/types';

import { selectActiveGroupCall, selectGroupCallParticipant } from '../../modules/selectors/calls';
import { pick } from '../../util/iteratees';
import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';

import './ActiveCallHeader.scss';

type StateProps = {
  isGroupCallPanelHidden?: boolean;
  meParticipant: GroupCallParticipant;
  groupCall?: ApiGroupCall;
};

type DispatchProps = Pick<GlobalActions, 'toggleGroupCallPanel'>;

const ActiveCallHeader: FC<StateProps & DispatchProps> = ({
  groupCall,
  meParticipant,
  isGroupCallPanelHidden,
  toggleGroupCallPanel,
}) => {
  const lang = useLang();

  useEffect(() => {
    document.body.classList.toggle('has-group-call-header', isGroupCallPanelHidden);
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
  (setGlobal, actions) => pick(actions, [
    'toggleGroupCallPanel',
  ]),
)(ActiveCallHeader));
