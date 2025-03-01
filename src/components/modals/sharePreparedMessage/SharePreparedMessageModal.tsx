import React, {
  type FC,
  memo, useEffect,
} from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type { TabState } from '../../../global/types';
import type { ThreadId } from '../../../types';
import { MAIN_THREAD_ID } from '../../../api/types';

import { getPeerTitle } from '../../../global/helpers';
import { selectPeer } from '../../../global/selectors';

import useFlag from '../../../hooks/useFlag';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import RecipientPicker from '../../common/RecipientPicker';

export type OwnProps = {
  modal: TabState['sharePreparedMessageModal'];
};

const SharePreparedMessageModal: FC<OwnProps> = ({
  modal,
}) => {
  const {
    closeSharePreparedMessageModal,
    sendInlineBotResult,
    sendWebAppEvent,
    showNotification,
  } = getActions();
  const lang = useOldLang();
  const isOpen = Boolean(modal);

  const [isShown, markIsShown, unmarkIsShown] = useFlag();
  useEffect(() => {
    if (isOpen) {
      markIsShown();
    }
  }, [isOpen, markIsShown]);

  const { message, filter, webAppKey } = modal || {};

  const handleClose = useLastCallback(() => {
    closeSharePreparedMessageModal();
    if (webAppKey) {
      sendWebAppEvent({
        webAppKey,
        event: {
          eventType: 'prepared_message_failed',
          eventData: { error: 'USER_DECLINED' },
        },
      });
    }
  });

  const handleSelectRecipient = useLastCallback((id: string, threadId?: ThreadId) => {
    if (message && webAppKey) {
      const global = getGlobal();
      const peer = selectPeer(global, id);
      sendInlineBotResult({
        chatId: id,
        threadId: threadId || MAIN_THREAD_ID,
        id: message.result.id,
        queryId: message.result.queryId,
      });
      sendWebAppEvent({
        webAppKey,
        event: {
          eventType: 'prepared_message_sent',
        },
      });
      showNotification({
        message: lang('BotSharedToOne', getPeerTitle(lang, peer!)),
      });
      closeSharePreparedMessageModal();
    }
  });

  if (!isOpen && !isShown) {
    return undefined;
  }

  return (
    <RecipientPicker
      isOpen={isOpen}
      searchPlaceholder={lang('Search')}
      filter={filter}
      onSelectRecipient={handleSelectRecipient}
      onClose={handleClose}
      onCloseAnimationEnd={unmarkIsShown}
    />
  );
};

export default memo(SharePreparedMessageModal);
