import { memo, useState } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ThreadId } from '../../types';
import { MAIN_THREAD_ID } from '../../api/types';

import { selectIsChatWithSelf } from '../../global/selectors';
import { selectThreadReadState } from '../../global/selectors/threads';
import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useShowTransition from '../../hooks/useShowTransition';

import Icon from '../common/icons/Icon';

import styles from './CatchUpPill.module.scss';

type OwnProps = {
  chatId: string;
  threadId: ThreadId;
};

type StateProps = {
  unreadCount?: number;
  isHiddenForChat?: boolean;
};

const MIN_UNREAD_COUNT = 15;

// Chats where the pill was dismissed or used, for the current session
const dismissedChatIds = new Set<string>();

const CatchUpPill = ({
  chatId,
  unreadCount,
  isHiddenForChat,
}: OwnProps & StateProps) => {
  const { openCatchUpModal } = getActions();
  const lang = useLang();
  const [dismissedKey, setDismissedKey] = useState<string | undefined>();

  const isOpen = Boolean(
    !isHiddenForChat && unreadCount && unreadCount >= MIN_UNREAD_COUNT
    && !dismissedChatIds.has(chatId) && dismissedKey !== chatId,
  );

  const { shouldRender, ref } = useShowTransition({
    isOpen,
    withShouldRender: true,
  });

  const handleOpen = useLastCallback(() => {
    dismissedChatIds.add(chatId);
    setDismissedKey(chatId);
    openCatchUpModal({ chatId });
  });

  const handleDismiss = useLastCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    dismissedChatIds.add(chatId);
    setDismissedKey(chatId);
  });

  if (!shouldRender) return undefined;

  return (
    <div ref={ref} className={styles.root}>
      <button type="button" className={buildClassName(styles.pill, 'no-selection')} onClick={handleOpen}>
        <Icon name="unread" className={styles.icon} />
        <span className={styles.label}>
          {lang('CatchUpPill', { count: unreadCount! }, { pluralValue: unreadCount! })}
        </span>
        <span className={styles.close} role="button" tabIndex={0} aria-label={lang('Close')} onClick={handleDismiss}>
          <Icon name="close" />
        </span>
      </button>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, threadId }): Complete<StateProps> => {
    const readState = threadId === MAIN_THREAD_ID ? selectThreadReadState(global, chatId, threadId) : undefined;

    return {
      unreadCount: readState?.unreadCount,
      isHiddenForChat: threadId !== MAIN_THREAD_ID || selectIsChatWithSelf(global, chatId),
    };
  },
)(CatchUpPill));
