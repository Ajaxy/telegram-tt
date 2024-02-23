import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiSticker, ApiUpdateConnectionStateType } from '../../api/types';
import type { MessageList } from '../../global/types';

import { selectChat, selectChatLastMessage, selectCurrentMessageList } from '../../global/selectors';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import StickerView from '../common/StickerView';

import './ContactGreeting.scss';

type OwnProps = {
  userId: string;
};

type StateProps = {
  stickers?: ApiSticker[];
  lastUnreadMessageId?: number;
  connectionState?: ApiUpdateConnectionStateType;
  currentMessageList?: MessageList;
};

const ContactGreeting: FC<OwnProps & StateProps> = ({
  stickers,
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

  const sticker = useMemo(() => {
    if (!stickers?.length) return undefined;

    const randomIndex = Math.floor(Math.random() * stickers.length);
    return stickers[randomIndex];
  }, [stickers]);

  useEffect(() => {
    if (stickers?.length || connectionState !== 'connectionStateReady') {
      return;
    }

    loadGreetingStickers();
  }, [connectionState, loadGreetingStickers, stickers]);

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
              shouldLoop
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
    const chat = selectChat(global, userId);
    if (!chat) {
      return {};
    }

    const lastMessage = selectChatLastMessage(global, chat.id);

    return {
      stickers,
      lastUnreadMessageId: lastMessage && lastMessage.id !== chat.lastReadInboxMessageId
        ? lastMessage.id
        : undefined,
      connectionState: global.connectionState,
      currentMessageList: selectCurrentMessageList(global),
    };
  },
)(ContactGreeting));
