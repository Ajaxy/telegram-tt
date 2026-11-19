import { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChat } from '../../../api/types';
import type { TabState } from '../../../global/types';

import { getChatTitle, isChatChannel } from '../../../global/helpers';
import { selectChat } from '../../../global/selectors';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import ConfirmDialog from '../../ui/ConfirmDialog';

export type OwnProps = {
  modal: NonNullable<TabState['joinGroupCallModal']>;
  isOpen: boolean;
};

type StateProps = {
  chat?: ApiChat;
};

const JoinGroupCallModal = ({ modal, isOpen, chat }: OwnProps & StateProps) => {
  const { requestMasterAndJoinGroupCall, closeJoinGroupCallModal } = getActions();

  const lang = useLang();

  const handleConfirm = useLastCallback(() => {
    const { id, accessHash, inviteHash } = modal;
    requestMasterAndJoinGroupCall({ id, accessHash, inviteHash });
    closeJoinGroupCallModal();
  });

  const handleClose = useLastCallback(() => {
    closeJoinGroupCallModal();
  });

  const isChannel = chat && isChatChannel(chat);

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={handleClose}
      textParts={lang(isChannel ? 'VoiceChatJoinConfirmChannel' : 'VoiceChatJoinConfirm', {
        chat: chat && getChatTitle(lang, chat),
      }, { withNodes: true, withMarkdown: true })}
      confirmLabel={lang('VoipChatJoin')}
      confirmHandler={handleConfirm}
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => ({
    chat: selectChat(global, modal.chatId),
  }),
)(JoinGroupCallModal));
