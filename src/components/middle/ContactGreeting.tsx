import type { FC } from '../../lib/teact/teact';
import React, { memo, useEffect, useRef } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiSticker, ApiUpdateConnectionStateType } from '../../api/types';
import type { MessageList } from '../../global/types';

import { getPeerIdDividend } from '../../global/helpers';
import { selectChat, selectCurrentMessageList } from '../../global/selectors';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import StickerView from '../common/StickerView';

import './ContactGreeting.scss';

type OwnProps = {
  userId: string;
};

type StateProps = {
  sticker?: ApiSticker;
  lastUnreadMessageId?: number;
  connectionState?: ApiUpdateConnectionStateType;
  currentMessageList?: MessageList;
};

const ContactGreeting: FC<OwnProps & StateProps> = ({
  sticker,
  connectionState,
  lastUnreadMessageId,
  currentMessageList,
}) => {
  const {
    loadGreetingStickers,
    sendMessage,
    markMessageListRead,
  } = getActions();

  const lang = useLang();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sticker || connectionState !== 'connectionStateReady') {
      return;
    }

    loadGreetingStickers();
  }, [connectionState, loadGreetingStickers, sticker]);

  useEffect(() => {
    if (connectionState === 'connectionStateReady' && lastUnreadMessageId) {
      markMessageListRead({ maxId: lastUnreadMessageId });
    }
  }, [connectionState, markMessageListRead, lastUnreadMessageId]);

  const handleStickerSelect = useLastCallback(() => {
    if (!currentMessageList) {
      return;
    }

    sendMessage({
      sticker: {
        ...sticker!,
        isPreloadedGlobally: true,
      },
      messageList: currentMessageList,
    });
  });

  return (
    <div className="ContactGreeting">
      <div className="wrapper">
        <p className="title" dir="auto">{lang('Conversation.EmptyPlaceholder')}</p>
        <p className="description" dir="auto">{lang('Conversation.GreetingText')}</p>

        <div ref={containerRef} className="sticker" onClick={handleStickerSelect}>
          {sticker && (
            <StickerView
              containerRef={containerRef}
              sticker={sticker}
              size={160}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { userId }): StateProps => {
    const { stickers } = global.stickers.greeting;
    const dividend = getPeerIdDividend(userId) + getPeerIdDividend(global.currentUserId!);
    const sticker = stickers?.length ? stickers[dividend % stickers.length] : undefined;
    const chat = selectChat(global, userId);
    if (!chat) {
      return {};
    }

    return {
      sticker,
      lastUnreadMessageId: chat.lastMessage && chat.lastMessage.id !== chat.lastReadInboxMessageId
        ? chat.lastMessage.id
        : undefined,
      connectionState: global.connectionState,
      currentMessageList: selectCurrentMessageList(global),
    };
  },
)(ContactGreeting));
