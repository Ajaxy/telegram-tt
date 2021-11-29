import React, { FC, memo, useState } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';

import { pick } from '../../util/iteratees';

import ConfirmDialog from '../ui/ConfirmDialog';
import Checkbox from '../ui/Checkbox';
import { selectCallFallbackChannelTitle } from '../../modules/selectors/calls';
import { getUserFullName } from '../../modules/helpers';
import { selectCurrentMessageList, selectUser } from '../../modules/selectors';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';

export type OwnProps = {
  isOpen: boolean;
};

interface StateProps {
  userFullName?: string;
  channelTitle: string;
}

type DispatchProps = Pick<GlobalActions, 'closeCallFallbackConfirm' | 'inviteToCallFallback'>;

const CallFallbackConfirm: FC<OwnProps & StateProps & DispatchProps> = ({
  isOpen,
  channelTitle,
  userFullName,
  closeCallFallbackConfirm,
  inviteToCallFallback,
}) => {
  const [shouldRemove, setShouldRemove] = useState(true);
  const renderingUserFullName = useCurrentOrPrev(userFullName, true);

  return (
    <ConfirmDialog
      title="Start Call"
      isOpen={isOpen}
      confirmHandler={() => {
        inviteToCallFallback({ shouldRemove });
      }}
      onClose={closeCallFallbackConfirm}
    >
      <p>The call will be started in a private channel <b>{channelTitle}</b>.</p>
      <Checkbox
        label={`Remove ${renderingUserFullName} from this channel after the call`}
        checked={shouldRemove}
        onCheck={setShouldRemove}
      />
    </ConfirmDialog>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { chatId } = selectCurrentMessageList(global) || {};
    const user = chatId ? selectUser(global, chatId) : undefined;

    return {
      userFullName: user ? getUserFullName(user) : undefined,
      channelTitle: selectCallFallbackChannelTitle(global),
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'closeCallFallbackConfirm', 'inviteToCallFallback',
  ]),
)(CallFallbackConfirm));
