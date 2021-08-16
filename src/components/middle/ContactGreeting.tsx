import React, {
  FC, memo, useCallback, useEffect, useRef,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';
import { ApiSticker, ApiUpdateConnectionStateType } from '../../api/types';

import { pick } from '../../util/iteratees';
import { selectChat } from '../../modules/selectors';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import useLang from '../../hooks/useLang';

import StickerButton from '../common/StickerButton';

import './ContactGreeting.scss';

type OwnProps = {
  userId: number;
};

type StateProps = {
  sticker?: ApiSticker;
  lastUnreadMessageId?: number;
  connectionState?: ApiUpdateConnectionStateType;
};

type DispatchProps = Pick<GlobalActions, 'loadGreetingStickers' | 'sendMessage' | 'markMessageListRead'>;

const INTERSECTION_DEBOUNCE_MS = 200;

const ContactGreeting: FC<OwnProps & StateProps & DispatchProps> = ({
  sticker,
  connectionState,
  lastUnreadMessageId,
  loadGreetingStickers,
  sendMessage,
  markMessageListRead,
}) => {
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
    const sticker = stickers && stickers.length ? stickers[userId % stickers.length] : undefined;
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
  (setGlobal, actions): DispatchProps => pick(actions, [
    'loadGreetingStickers', 'sendMessage', 'markMessageListRead',
  ]),

)(ContactGreeting));
