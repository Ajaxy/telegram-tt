import { memo, useEffect } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiChatType } from '../../api/types';
import type { TabState } from '../../global/types';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import RecipientPicker from '../common/RecipientPicker';

export type OwnProps = {
  requestedAttachBotInChat?: TabState['requestedAttachBotInChat'];
  requestedBotStartGroup?: TabState['requestedBotStartGroup'];
};

const BOT_GROUP_FILTER: ApiChatType[] = ['chats', 'groups'];

const AttachBotRecipientPicker = ({
  requestedAttachBotInChat,
  requestedBotStartGroup,
}: OwnProps) => {
  const {
    callAttachBot, cancelAttachBotInChat, cancelBotStartGroup, openChat, startBot,
  } = getActions();
  const lang = useLang();

  const isOpen = Boolean(requestedAttachBotInChat || requestedBotStartGroup);
  const [isShown, markIsShown, unmarkIsShown] = useFlag();
  useEffect(() => {
    if (isOpen) {
      markIsShown();
    }
  }, [isOpen, markIsShown]);

  const filter = requestedBotStartGroup ? BOT_GROUP_FILTER : requestedAttachBotInChat?.filter;

  const handleClose = useLastCallback(() => {
    if (requestedBotStartGroup) {
      cancelBotStartGroup();
      return;
    }
    cancelAttachBotInChat();
  });

  const handlePeerRecipient = useLastCallback((recipientId: string) => {
    if (requestedBotStartGroup) {
      startBot({
        botId: requestedBotStartGroup.bot.id,
        chatId: recipientId,
        param: requestedBotStartGroup.startParam,
      });
      openChat({ id: recipientId });
      cancelBotStartGroup();
      return;
    }

    const { bot, startParam } = requestedAttachBotInChat!;
    callAttachBot({ bot, chatId: recipientId, startParam });
    cancelAttachBotInChat();
  });

  if (!isOpen && !isShown) {
    return undefined;
  }

  return (
    <RecipientPicker
      isOpen={isOpen}
      title={lang('SelectChat')}
      searchPlaceholder={lang('Search')}
      filter={filter}
      shouldFilterInviteable={Boolean(requestedBotStartGroup)}
      onSelectRecipient={handlePeerRecipient}
      onClose={handleClose}
      onCloseAnimationEnd={unmarkIsShown}
    />
  );
};

export default memo(AttachBotRecipientPicker);
