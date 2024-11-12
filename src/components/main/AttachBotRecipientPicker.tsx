import type { FC } from '../../lib/teact/teact';
import React, { memo, useCallback, useEffect } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { TabState } from '../../global/types';

import useFlag from '../../hooks/useFlag';
import useOldLang from '../../hooks/useOldLang';

import RecipientPicker from '../common/RecipientPicker';

export type OwnProps = {
  requestedAttachBotInChat?: TabState['requestedAttachBotInChat'];
};

const AttachBotRecipientPicker: FC<OwnProps> = ({
  requestedAttachBotInChat,
}) => {
  const { cancelAttachBotInChat, callAttachBot } = getActions();
  const lang = useOldLang();

  const isOpen = Boolean(requestedAttachBotInChat);
  const [isShown, markIsShown, unmarkIsShown] = useFlag();
  useEffect(() => {
    if (isOpen) {
      markIsShown();
    }
  }, [isOpen, markIsShown]);

  const { bot, filter, startParam } = requestedAttachBotInChat || {};

  const handlePeerRecipient = useCallback((recipientId: string) => {
    callAttachBot({ bot: bot!, chatId: recipientId, startParam });
    cancelAttachBotInChat();
  }, [bot, callAttachBot, cancelAttachBotInChat, startParam]);

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
