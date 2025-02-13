import type { FC } from '../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiChat, ApiTopic } from '../../../api/types';
import type { Signal } from '../../../util/signals';

import buildClassName from '../../../util/buildClassName';
import { isSignal } from '../../../util/signals';
import { formatIntegerCompact } from '../../../util/textFormat';
import { extractCurrentThemeParams } from '../../../util/themeStyle';

import useDerivedState from '../../../hooks/useDerivedState';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import AnimatedCounter from '../../common/AnimatedCounter';
import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import ShowTransition from '../../ui/ShowTransition';

import './ChatBadge.scss';

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
  topics?: Record<number, ApiTopic>;
  isSelected?: boolean;
};

const ChatBadge: FC<OwnProps> = ({
  topic,
  topics,
  chat,
  isPinned,
  isMuted,
  shouldShowOnlyMostImportant,
  wasTopicOpened,
  forceHidden,
  isSavedDialog,
  hasMiniApp,
  isSelected,
}) => {
  const { requestMainWebView } = getActions();

  const oldLang = useOldLang();

  const {
    unreadMentionsCount = 0, unreadReactionsCount = 0,
  } = !chat.isForum ? chat : {}; // TODO[forums] Unread mentions and reactions temporarily disabled for forums

  const isTopicUnopened = !isPinned && topic && !wasTopicOpened;
  const isForum = chat.isForum && !topic;
  const topicsWithUnread = useMemo(() => (
    isForum && topics ? Object.values(topics).filter(({ unreadCount }) => unreadCount) : undefined
  ), [topics, isForum]);

  const unreadCount = useMemo(() => (
    isForum
      // If we have unmuted topics, display the count of those. Otherwise, display the count of all topics.
      ? ((isMuted && topicsWithUnread?.filter((acc) => acc.isMuted === false).length)
        || topicsWithUnread?.length)
      : (topic || chat).unreadCount
  ), [chat, topic, topicsWithUnread, isForum, isMuted]);

  const shouldBeMuted = useMemo(() => {
    const hasUnmutedUnreadTopics = topics
      && Object.values(topics).some((acc) => !acc.isMuted && acc.unreadCount);

    return isMuted || (topics && !hasUnmutedUnreadTopics);
  }, [topics, isMuted]);

  const hasUnreadMark = topic ? false : chat.hasUnreadMark;

  const resolvedForceHidden = useDerivedState(
    () => (isSignal(forceHidden) ? forceHidden() : forceHidden),
    [forceHidden],
  );
  const isShown = !resolvedForceHidden && Boolean(
    unreadCount || unreadMentionsCount || hasUnreadMark || isPinned || unreadReactionsCount
    || isTopicUnopened || hasMiniApp,
  );

  const isUnread = Boolean((unreadCount || hasUnreadMark) && !isSavedDialog);
  const className = buildClassName(
    'ChatBadge',
    shouldBeMuted && 'muted',
    !isUnread && isPinned && 'pinned',
    isUnread && 'unread',
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
    const unreadReactionsElement = unreadReactionsCount && (
      <div className={buildClassName('ChatBadge reaction', shouldBeMuted && 'muted')}>
        <Icon name="heart" />
      </div>
    );

    const unreadMentionsElement = unreadMentionsCount && (
      <div className="ChatBadge mention">
        <Icon name="mention" />
      </div>
    );

    const unopenedTopicElement = isTopicUnopened && (
      <div className={buildClassName('ChatBadge unopened', shouldBeMuted && 'muted')} />
    );

    const unreadCountElement = (hasUnreadMark || unreadCount) ? (
      <div className={className}>
        {!hasUnreadMark && <AnimatedCounter text={formatIntegerCompact(unreadCount!)} />}
      </div>
    ) : undefined;

    const pinnedElement = isPinned && (
      <div className={className}>
        <Icon name="pinned-chat" />
      </div>
    );

    const miniAppButton = hasMiniApp && (
      <Button
        color={isSelected ? 'secondary' : 'primary'}
        className="ChatBadge miniapp"
        pill
        size="tiny"
        onClick={handleOpenApp}
      >
        {oldLang('BotOpen')}
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
      <div className="ChatBadge-wrapper">
        {elements}
      </div>
    );
  }

  return (
    <ShowTransition isCustom className="ChatBadge-transition" isOpen={isShown}>
      {renderContent()}
    </ShowTransition>
  );
};

export default memo(ChatBadge);
