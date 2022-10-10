import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import useLang from '../../hooks/useLang';
import useFlag from '../../hooks/useFlag';

import RecipientPicker from '../common/RecipientPicker';

export type OwnProps = {
  isOpen: boolean;
};

interface StateProps {
  currentUserId?: string;
  isManyMessages?: boolean;
}

const ForwardRecipientPicker: FC<OwnProps & StateProps> = ({
  isOpen,
  currentUserId,
  isManyMessages,
}) => {
  const {
    setForwardChatId,
    exitForwardMode,
    forwardToSavedMessages,
    showNotification,
  } = getActions();

  const lang = useLang();

  const [isShown, markIsShown, unmarkIsShown] = useFlag();
  useEffect(() => {
    if (isOpen) {
      markIsShown();
    }
  }, [isOpen, markIsShown]);

  const handleSelectRecipient = useCallback((recipientId: string) => {
    if (recipientId === currentUserId) {
      forwardToSavedMessages();
      showNotification({
        message: lang(isManyMessages
          ? 'Conversation.ForwardTooltip.SavedMessages.Many'
          : 'Conversation.ForwardTooltip.SavedMessages.One'),
      });
    } else {
      setForwardChatId({ id: recipientId });
    }
  }, [currentUserId, forwardToSavedMessages, isManyMessages, lang, setForwardChatId, showNotification]);

  const handleClose = useCallback(() => {
    exitForwardMode();
  }, [exitForwardMode]);

  if (!isOpen && !isShown) {
    return undefined;
  }

  return (
    <RecipientPicker
      isOpen={isOpen}
      searchPlaceholder={lang('ForwardTo')}
      onSelectRecipient={handleSelectRecipient}
      onClose={handleClose}
      onCloseAnimationEnd={unmarkIsShown}
    />
  );
};

export default memo(withGlobal<OwnProps>((global): StateProps => {
  return {
    currentUserId: global.currentUserId,
    isManyMessages: (global.forwardMessages.messageIds?.length || 0) > 1,
  };
})(ForwardRecipientPicker));
