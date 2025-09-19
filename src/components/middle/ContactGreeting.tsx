import type { FC } from '../../lib/teact/teact';
import {
  memo, useEffect, useMemo, useRef,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiBusinessIntro, ApiSticker, ApiUpdateConnectionStateType, ApiUser,
} from '../../api/types';
import type { MessageList } from '../../types';

import { getUserFullName } from '../../global/helpers';
import {
  selectChat,
  selectChatLastMessage,
  selectCurrentMessageList,
  selectUser,
  selectUserFullInfo,
} from '../../global/selectors';

import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import StickerView from '../common/StickerView';

import styles from './ContactGreeting.module.scss';

type OwnProps = {
  userId: string;
};

type StateProps = {
  defaultStickers?: ApiSticker[];
  lastUnreadMessageId?: number;
  connectionState?: ApiUpdateConnectionStateType;
  currentMessageList?: MessageList;
  businessIntro?: ApiBusinessIntro;
  user?: ApiUser;
};

const ContactGreeting: FC<OwnProps & StateProps> = ({
  defaultStickers,
  connectionState,
  lastUnreadMessageId,
  currentMessageList,
  businessIntro,
  user,
}) => {
  const {
    loadGreetingStickers,
    sendMessage,
    markMessageListRead,
  } = getActions();

  const lang = useOldLang();

  const containerRef = useRef<HTMLDivElement>();

  const sticker = useMemo(() => {
    if (businessIntro?.sticker) return businessIntro.sticker;
    if (!defaultStickers?.length) return undefined;

    const randomIndex = Math.floor(Math.random() * defaultStickers.length);
    return defaultStickers[randomIndex];
  }, [businessIntro?.sticker, defaultStickers]);

  useEffect(() => {
    if (defaultStickers?.length || connectionState !== 'connectionStateReady') {
      return;
    }

    loadGreetingStickers();
  }, [connectionState, loadGreetingStickers, defaultStickers]);

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

  const title = businessIntro?.title || lang('Conversation.EmptyPlaceholder');
  const description = businessIntro?.description || lang('Conversation.GreetingText');

  return (
    <div className={styles.root}>
      <div className={styles.wrapper}>
        <p className={styles.title} dir="auto">{title}</p>
        <p className={styles.description} dir="auto">{description}</p>

        <div ref={containerRef} className={styles.sticker} onClick={handleStickerSelect}>
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
      {businessIntro && (
        <div className={styles.explainer}>
          {lang('Chat.EmptyStateIntroFooter', getUserFullName(user))}
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { userId }): Complete<StateProps> => {
    const { stickers } = global.stickers.greeting;
    const chat = selectChat(global, userId);
    if (!chat) {
      return {} as Complete<StateProps>;
    }

    const user = selectUser(global, userId);
    const fullInfo = selectUserFullInfo(global, userId);

    const lastMessage = selectChatLastMessage(global, chat.id);

    return {
      defaultStickers: stickers,
      lastUnreadMessageId: lastMessage && lastMessage.id !== chat.lastReadInboxMessageId
        ? lastMessage.id
        : undefined,
      connectionState: global.connectionState,
      currentMessageList: selectCurrentMessageList(global),
      businessIntro: fullInfo?.businessIntro,
      user,
    };
  },
)(ContactGreeting));
