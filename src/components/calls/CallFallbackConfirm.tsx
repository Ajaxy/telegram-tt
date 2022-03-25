import React, {
  FC, memo, useCallback, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import ConfirmDialog from '../ui/ConfirmDialog';
import Checkbox from '../ui/Checkbox';
import { selectCallFallbackChannelTitle } from '../../global/selectors/calls';
import { getUserFullName } from '../../global/helpers';
import { selectCurrentMessageList, selectUser } from '../../global/selectors';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';

export type OwnProps = {
  isOpen: boolean;
};

interface StateProps {
  userFullName?: string;
  channelTitle: string;
}

const CallFallbackConfirm: FC<OwnProps & StateProps> = ({
  isOpen,
  channelTitle,
  userFullName,
}) => {
  const {
    closeCallFallbackConfirm,
    inviteToCallFallback,
  } = getActions();

  const [shouldRemove, setShouldRemove] = useState(true);
  const renderingUserFullName = useCurrentOrPrev(userFullName, true);

  const handleConfirm = useCallback(() => {
    inviteToCallFallback({ shouldRemove });
  }, [inviteToCallFallback, shouldRemove]);

  return (
    <ConfirmDialog
      title="Start Call"
      isOpen={isOpen}
      confirmHandler={handleConfirm}
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
)(CallFallbackConfirm));
