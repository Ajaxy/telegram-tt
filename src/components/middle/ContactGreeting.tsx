import type { FC } from '../../lib/teact/teact';
import {
  memo, useEffect, useMemo, useRef,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { MessageList } from '../../types';
import {
  type ApiBusinessIntro, type ApiSticker, type ApiUpdateConnectionStateType, type ApiUser,
  MAIN_THREAD_ID,
} from '../../api/types';

import { getUserFullName } from '../../global/helpers';
import {
  selectChat,
  selectChatLastMessageId,
  selectCurrentMessageList,
  selectUser,
  selectUserFullInfo,
} from '../../global/selectors';
import { selectThreadReadState } from '../../global/selectors/threads';

import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import StickerView from '../common/StickerView';

import styles from './ContactGreeting.module.scss';

type OwnProps = {
  userId: string;
};

type StateProps = {
  defaultStickers?: ApiSticker[];
  lastMessageId?: number;
  connectionState?: ApiUpdateConnectionStateType;
  currentMessageList?: MessageList;
  businessIntro?: ApiBusinessIntro;
  user?: ApiUser;
};

const ContactGreeting: FC<OwnProps & StateProps> = ({
  defaultStickers,
  connectionState,
  lastMessageId,
  currentMessageList,
  businessIntro,
  user,
}) => {
  const {
    loadGreetingStickers,
    sendMessage,
    markMessageListRead,
  } = getActions();

  const oldLang = useOldLang();

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
    if (connectionState === 'connectionStateReady' && lastMessageId) {
      markMessageListRead({ maxId: lastMessageId });
    }
  }, [connectionState, lastMessageId]);

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

  const title = businessIntro?.title || oldLang('Conversation.EmptyPlaceholder');
  const description = businessIntro?.description || oldLang('Conversation.GreetingText');

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
          {oldLang('Chat.EmptyStateIntroFooter', getUserFullName(user))}
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
    const {
      unreadCount,
    } = selectThreadReadState(global, chat.id, MAIN_THREAD_ID) || {};

    // Pass last message id only if there are unread messages
    const lastMessageId = selectChatLastMessageId(global, chat.id);

    return {
      defaultStickers: stickers,
      lastMessageId: unreadCount ? lastMessageId : undefined,
      connectionState: global.connectionState,
      currentMessageList: selectCurrentMessageList(global),
      businessIntro: fullInfo?.businessIntro,
      user,
    };
  },
)(ContactGreeting));
