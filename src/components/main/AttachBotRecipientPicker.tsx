import React, { memo, useCallback, useEffect } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { FC } from '../../lib/teact/teact';
import type { GlobalState } from '../../global/types';

import useLang from '../../hooks/useLang';
import useFlag from '../../hooks/useFlag';

import RecipientPicker from '../common/RecipientPicker';

export type OwnProps = {
  requestedAttachBotInChat?: GlobalState['requestedAttachBotInChat'];
};

const AttachBotRecipientPicker: FC<OwnProps> = ({
  requestedAttachBotInChat,
}) => {
  const { cancelAttachBotInChat, callAttachBot } = getActions();
  const lang = useLang();

  const isOpen = Boolean(requestedAttachBotInChat);
  const [isShown, markIsShown, unmarkIsShown] = useFlag();
  useEffect(() => {
    if (isOpen) {
      markIsShown();
    }
  }, [isOpen, markIsShown]);

  const { botId, filter, startParam } = requestedAttachBotInChat || {};

  const handlePeerRecipient = useCallback((recipientId: string) => {
    callAttachBot({ botId: botId!, chatId: recipientId, startParam });
    cancelAttachBotInChat();
  }, [botId, callAttachBot, cancelAttachBotInChat, startParam]);

  if (!isOpen && !isShown) {
    return undefined;
  }

  return (
    <RecipientPicker
      isOpen={isOpen}
      searchPlaceholder={lang('Search')}
      filter={filter}
      onSelectRecipient={handlePeerRecipient}
      onClose={cancelAttachBotInChat}
      onCloseAnimationEnd={unmarkIsShown}
    />
  );
};

export default memo(AttachBotRecipientPicker);
