import { memo, useCallback, useMemo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { GlobalState } from '../../../global/types';
import type { Signal } from '../../../util/signals';
import { type ApiChat, type ApiTopic, MAIN_THREAD_ID } from '../../../api/types';

import { selectTopicsInfo } from '../../../global/selectors';
import { selectThreadReadState } from '../../../global/selectors/threads';
import buildClassName from '../../../util/buildClassName';
import { buildCollectionByCallback } from '../../../util/iteratees';
import { getServerTime } from '../../../util/serverTime';
import { isSignal } from '../../../util/signals';
import { formatIntegerCompact } from '../../../util/textFormat';
import { extractCurrentThemeParams } from '../../../util/themeStyle';

import useSelector, { useShallowSelector } from '../../../hooks/data/useSelector';
import useDerivedState from '../../../hooks/useDerivedState';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AnimatedCounter from '../../common/AnimatedCounter';
import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import ShowTransition from '../../ui/ShowTransition';

import styles from './ChatBadge.module.scss';

type OwnProps = {
  chat: ApiChat;
  topic?: ApiTopic;
  wasTopicOpened?: boolean;
  isPinned?: boolean;
  isMuted?: boolean;
  isSavedDialog?: boolean;
  shouldShowOnlyMostImportant?: boolean;
  hasMiniApp?: boolean;
  forceHidden?: boolean | Signal<boolean>;
  isSelected?: boolean;
  isOnAvatar?: boolean;
  transitionClassName?: string;
  badgeClassName?: string;
};

const ChatBadge = ({
  topic,
  chat,
  isPinned,
  isMuted,
  shouldShowOnlyMostImportant,
  wasTopicOpened,
  forceHidden,
  isSavedDialog,
  hasMiniApp,
  isSelected,
  isOnAvatar,
  transitionClassName,
  badgeClassName,
}: OwnProps) => {
  const { requestMainWebView } = getActions();

  const lang = useLang();

  const readStateSelector = useCallback((global: GlobalState) => {
    return selectThreadReadState(global, chat.id, topic?.id || MAIN_THREAD_ID);
  }, [chat.id, topic?.id]);

  const readState = useSelector(readStateSelector);

  const {
    unreadMentionsCount: stateUnreadMentionsCount = 0,
    unreadReactionsCount: stateUnreadReactionsCount = 0,
    unreadCount: stateUnreadCount = 0,
    hasUnreadMark,
  } = readState || {};

  const topicsInfoSelector = useCallback((global: GlobalState) => {
    return selectTopicsInfo(global, chat.id);
  }, [chat.id]);
  const topicsInfo = useShallowSelector(topicsInfoSelector);
  const { listedTopicIds, topicsById } = topicsInfo || {};

  const topicsReadStateSelector = useCallback((global: GlobalState) => {
    return buildCollectionByCallback(listedTopicIds || [], (tId) => (
      [tId, selectThreadReadState(global, chat.id, tId)]
    ));
  }, [chat.id, listedTopicIds]);
  const topicsReadStates = useShallowSelector(topicsReadStateSelector);

  const isTopicUnopened = !isPinned && topic && !wasTopicOpened;
  const isForum = chat.isForum && !topic;
  const topicsWithUnreadIds = useMemo(() => (
    isForum && listedTopicIds ? listedTopicIds.filter((tId) => topicsReadStates[tId]?.unreadCount) : undefined
  ), [listedTopicIds, isForum, topicsReadStates]);
  const topicsWithUnreadMentionsIds = useMemo(() => (
    isForum && listedTopicIds ? listedTopicIds.filter((tId) => topicsReadStates[tId]?.unreadMentionsCount) : undefined
  ), [listedTopicIds, isForum, topicsReadStates]);
  const topicsWithUnreadReactionsIds = useMemo(() => (
    isForum && listedTopicIds ? listedTopicIds.filter((tId) => topicsReadStates[tId]?.unreadReactionsCount) : undefined
  ), [listedTopicIds, isForum, topicsReadStates]);

  const unreadCount = isForum ? topicsWithUnreadIds?.length : stateUnreadCount;
  const unreadMentionsCount = isForum ? topicsWithUnreadMentionsIds?.length : stateUnreadMentionsCount;
  const unreadReactionsCount = isForum ? topicsWithUnreadReactionsIds?.length : stateUnreadReactionsCount;

  const shouldBeUnMuted = useMemo(() => {
    if (!isForum) {
      return !isMuted || topic?.notifySettings.mutedUntil === 0;
    }

    if (isMuted) {
      return topicsWithUnreadIds?.some((tId) => topicsById?.[tId]?.notifySettings.mutedUntil === 0);
    }

    const isEveryUnreadMuted = topicsWithUnreadIds?.every((tId) => {
      const mutedUntil = topicsById?.[tId]?.notifySettings.mutedUntil;
      return mutedUntil && mutedUntil > getServerTime();
    });

    return !isEveryUnreadMuted;
  }, [isForum, isMuted, topicsWithUnreadIds, topicsById, topic?.notifySettings.mutedUntil]);

  const isUnread = Boolean((unreadCount || hasUnreadMark) && !isSavedDialog);

  const resolvedForceHidden = useDerivedState(
    () => (isSignal(forceHidden) ? forceHidden() : forceHidden),
    [forceHidden],
  );
  const isShown = !resolvedForceHidden && Boolean(
    unreadCount || unreadMentionsCount || hasUnreadMark || isPinned || unreadReactionsCount
    || isTopicUnopened || hasMiniApp,
  );

  const handleOpenApp = useLastCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.stopPropagation();

    const theme = extractCurrentThemeParams();
    requestMainWebView({
      botId: chat.id,
      peerId: chat.id,
      theme,
    });
  });

  function renderContent() {
    const baseClassName = buildClassName(styles.badge, badgeClassName);
    const statefulClassName = buildClassName(baseClassName, !shouldBeUnMuted && styles.muted);

    const unreadReactionsElement = unreadReactionsCount && (
      <div className={buildClassName(statefulClassName, styles.reaction, styles.round)}>
        <Icon name="heart" />
      </div>
    );

    const unreadMentionsElement = unreadMentionsCount && (
      <div className={buildClassName(statefulClassName, styles.mention, styles.round)}>
        <Icon name="mention" />
      </div>
    );

    const unopenedTopicElement = isTopicUnopened && (
      <div className={buildClassName(statefulClassName, styles.unopened)} />
    );

    const unreadCountElement = isUnread ? (
      <div className={buildClassName(statefulClassName, styles.unread)}>
        {!hasUnreadMark && <AnimatedCounter text={formatIntegerCompact(lang, unreadCount!)} />}
      </div>
    ) : undefined;

    const pinnedElement = isPinned && (
      <div className={buildClassName(baseClassName, styles.pinned)}>
        <Icon name="pinned-chat" />
      </div>
    );

    const miniAppButton = hasMiniApp && (
      <Button
        color={isSelected ? 'secondary' : 'primary'}
        className={buildClassName(baseClassName, styles.miniapp)}
        pill
        size="tiny"
        onClick={handleOpenApp}
      >
        {lang('BotChatMiniAppOpen')}
      </Button>
    );

    const visiblePinnedElement = !unreadCountElement && !unreadMentionsElement && !unreadReactionsElement
      && pinnedElement;

    const elements = [
      unopenedTopicElement, unreadReactionsElement, unreadMentionsElement, unreadCountElement, visiblePinnedElement,
    ].filter(Boolean);

    if (isSavedDialog) return pinnedElement;

    // Show only if empty or have pinned icon
    if (hasMiniApp && (elements.length === 0 || visiblePinnedElement)) return miniAppButton;

    if (elements.length === 0) return undefined;

    if (elements.length === 1) return elements[0];

    if (shouldShowOnlyMostImportant) {
      const importanceOrderedElements = [
        unreadMentionsElement, unreadCountElement, unreadReactionsElement, pinnedElement,
      ].filter(Boolean);
      return importanceOrderedElements[0];
    }

    return (
      <div className={styles.wrapper}>
        {elements}
      </div>
    );
  }

  return (
    <ShowTransition
      isCustom
      className={buildClassName(
        styles.transition,
        isSelected && styles.selected,
        isOnAvatar && styles.onAvatar,
        transitionClassName,
      )}
      isOpen={isShown}
    >
      {renderContent()}
    </ShowTransition>
  );
};

export default memo(ChatBadge);
