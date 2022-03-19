import React, {
  FC, memo, useCallback, useEffect, useRef,
} from '../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../modules';

import { ApiSticker, ApiUpdateConnectionStateType } from '../../api/types';

import { selectChat } from '../../modules/selectors';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import useLang from '../../hooks/useLang';
import { getUserIdDividend } from '../../modules/helpers';

import StickerButton from '../common/StickerButton';

import './ContactGreeting.scss';

type OwnProps = {
  userId: string;
};

type StateProps = {
  sticker?: ApiSticker;
  lastUnreadMessageId?: number;
  connectionState?: ApiUpdateConnectionStateType;
};

const INTERSECTION_DEBOUNCE_MS = 200;

const ContactGreeting: FC<OwnProps & StateProps> = ({
  sticker,
  connectionState,
  lastUnreadMessageId,
}) => {
  const {
    loadGreetingStickers,
    sendMessage,
    markMessageListRead,
  } = getDispatch();

  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    observe: observeIntersection,
  } = useIntersectionObserver({
    rootRef: containerRef,
    debounceMs: INTERSECTION_DEBOUNCE_MS,
  });
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

  const handleStickerSelect = useCallback((selectedSticker: ApiSticker) => {
    selectedSticker = {
      ...selectedSticker,
      isPreloadedGlobally: true,
    };
    sendMessage({ sticker: selectedSticker });
  }, [sendMessage]);

  return (
    <div className="ContactGreeting" ref={containerRef}>
      <div className="wrapper">
        <p className="title" dir="auto">{lang('Conversation.EmptyPlaceholder')}</p>
        <p className="description" dir="auto">{lang('Conversation.GreetingText')}</p>

        <div className="sticker">
          {sticker && (
            <StickerButton
              sticker={sticker}
              onClick={handleStickerSelect}
              clickArg={sticker}
              observeIntersection={observeIntersection}
              size={160}
              className="large"
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
    const dividend = getUserIdDividend(userId) + getUserIdDividend(global.currentUserId!);
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
    };
  },
)(ContactGreeting));
