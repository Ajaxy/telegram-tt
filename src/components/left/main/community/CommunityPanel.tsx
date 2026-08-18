import {
  beginHeavyAnimation,
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiChat, ApiChatFullInfo } from '../../../../api/types';
import type { GlobalState } from '../../../../global/types';

import { requestNextMutation } from '../../../../lib/fasterdom/fasterdom';
import {
  selectCanAnimateInterface,
  selectChat,
  selectChatFullInfo,
  selectChatLastMessage,
  selectCommunityPanelId,
} from '../../../../global/selectors';
import { IS_TOUCH_ENV } from '../../../../util/browser/windowEnvironment';
import buildClassName from '../../../../util/buildClassName';
import captureEscKeyListener from '../../../../util/captureEscKeyListener';
import { captureEvents, SwipeDirection } from '../../../../util/captureEvents';
import { waitForTransitionEnd } from '../../../../util/cssAnimationEndListeners';
import { isUserId } from '../../../../util/entities/ids';
import { ChatAnimationTypes } from '../hooks';

import { useShallowSelector } from '../../../../hooks/data/useSelector';
import useFlag from '../../../../hooks/useFlag';
import useHistoryBack from '../../../../hooks/useHistoryBack';
import useInfiniteScroll from '../../../../hooks/useInfiniteScroll';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import usePreviousDeprecated from '../../../../hooks/usePreviousDeprecated';
import useScrollNotch from '../../../../hooks/useScrollNotch';
import useSyncEffect from '../../../../hooks/useSyncEffect';

import Avatar from '../../../common/Avatar';
import FullNameTitle from '../../../common/FullNameTitle';
import Island, { IslandDescription } from '../../../gili/layout/Island';
import Surface from '../../../gili/layout/Surface';
import Button from '../../../ui/Button';
import ConfirmDialog from '../../../ui/ConfirmDialog';
import InfiniteScroll from '../../../ui/InfiniteScroll';
import ListItem from '../../../ui/ListItem';
import Loading from '../../../ui/Loading';
import SearchInput from '../../../ui/SearchInput';
import Switcher from '../../../ui/Switcher';
import Transition, { ACTIVE_SLIDE_CLASS_NAME, TO_SLIDE_CLASS_NAME } from '../../../ui/Transition';
import Chat from '../Chat';

import styles from './CommunityPanel.module.scss';

type OwnProps = {
  isOpen?: boolean;
  isHidden?: boolean;
  onCloseAnimationEnd?: VoidFunction;
  onOpenAnimationStart?: VoidFunction;
};

type CommunityPeerEntry = {
  id: string;
  title: string;
};

type DatedPeerEntry = CommunityPeerEntry & {
  date: number;
};

type RequestablePeerEntry = {
  peer: ApiChat;
  date: number;
  isVisible?: boolean;
};

const COMMUNITY_CHATS_SLICE = 20;
const CONTENT_SCROLL_SELECTOR = [
  `.${styles.contentTransition} > .${ACTIVE_SLIDE_CLASS_NAME} .${styles.content}`,
  `.${styles.contentTransition} > .${TO_SLIDE_CLASS_NAME} .${styles.content}`,
].join(',');

type StateProps = {
  community?: ApiChat;
  fullInfo?: ApiChatFullInfo;
  withInterfaceAnimations?: boolean;
};

const CommunityPanel = ({
  isOpen,
  isHidden,
  community,
  fullInfo,
  withInterfaceAnimations,
  onCloseAnimationEnd,
  onOpenAnimationStart,
}: OwnProps & StateProps) => {
  const {
    closeCommunityPanel, toggleCommunityCollapsed, joinChannel, openChat, showNotification,
  } = getActions();

  const ref = useRef<HTMLDivElement>();
  const lang = useLang();

  const linkedPeersSelector = useCallback((global: GlobalState) => (
    fullInfo?.linkedPeers?.map(({ peerId }) => selectChat(global, peerId))
  ), [fullInfo?.linkedPeers]);
  const linkedPeers = useShallowSelector(linkedPeersSelector);

  const linkedPeerLastMessagesSelector = useCallback((global: GlobalState) => (
    fullInfo?.linkedPeers?.map(({ peerId }) => selectChatLastMessage(global, peerId))
  ), [fullInfo?.linkedPeers]);
  const linkedPeerLastMessages = useShallowSelector(linkedPeerLastMessagesSelector);

  const {
    joinedPeers, viewablePeers, requestablePeers,
  } = useMemo(() => {
    const nextJoinedPeers: DatedPeerEntry[] = [];
    const nextViewablePeers: DatedPeerEntry[] = [];
    const nextRequestablePeers: RequestablePeerEntry[] = [];

    fullInfo?.linkedPeers?.forEach(({ peerId, canViewHistory, isVisible }, index) => {
      const peer = linkedPeers?.[index];
      if (!peer) return;

      const lastMessage = linkedPeerLastMessages?.[index];
      const date = Math.max(peer.creationDate || 0, lastMessage?.date || 0);
      const isUser = isUserId(peerId);
      const isJoined = isUser ? Boolean(lastMessage) : !peer.isNotJoined;

      if (isJoined) {
        nextJoinedPeers.push({ id: peerId, title: peer.title, date });
      } else if (!isUser && canViewHistory) {
        nextViewablePeers.push({ id: peerId, title: peer.title, date });
      } else {
        nextRequestablePeers.push({ peer, date, isVisible });
      }
    });

    return {
      joinedPeers: sortByFreshest(nextJoinedPeers),
      viewablePeers: sortByFreshest(nextViewablePeers),
      requestablePeers: sortByFreshest(nextRequestablePeers),
    };
  }, [fullInfo?.linkedPeers, linkedPeerLastMessages, linkedPeers]);

  const isVisible = isOpen && !isHidden;
  const prevIsVisible = usePreviousDeprecated(isVisible);

  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, openSearch, closeSearch] = useFlag();
  const [searchQuery, setSearchQuery] = useState('');

  useScrollNotch({
    containerRef: ref,
    selector: CONTENT_SCROLL_SELECTOR,
    shouldHideTopNotch: true,
    onScrolled: setIsScrolled,
  }, [isSearchOpen]);

  // The panel can switch to another community without closing
  useSyncEffect(([prevCommunityId]) => {
    if (prevCommunityId !== undefined && prevCommunityId !== community?.id) {
      closeSearch();
      setSearchQuery('');
    }
  }, [community?.id, closeSearch]);

  const filteredPeers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return { joined: joinedPeers, viewable: viewablePeers, requestable: requestablePeers };
    }

    const match = (peers: CommunityPeerEntry[]) => peers.filter(
      (peer) => peer.title.toLowerCase().includes(query),
    );

    return {
      joined: match(joinedPeers),
      viewable: match(viewablePeers),
      requestable: requestablePeers.filter(({ peer }) => peer.title.toLowerCase().includes(query)),
    };
  }, [searchQuery, joinedPeers, viewablePeers, requestablePeers]);

  const hasResults = Boolean(
    filteredPeers.joined.length || filteredPeers.viewable.length || filteredPeers.requestable.length,
  );

  const listedPeerIds = useMemo(() => [
    ...filteredPeers.joined.map(({ id }) => id),
    ...filteredPeers.viewable.map(({ id }) => id),
    ...filteredPeers.requestable.map(({ peer }) => peer.id),
  ], [filteredPeers]);

  const [viewportIds, getMore] = useInfiniteScroll(undefined, listedPeerIds, undefined, COMMUNITY_CHATS_SLICE);

  // The viewport is a prefix of the concatenated groups, so each section stays contiguous
  const viewportSections = useMemo(() => {
    const viewportIdSet = new Set(viewportIds);
    const filterViewport = (peers: CommunityPeerEntry[]) => peers.filter(({ id }) => viewportIdSet.has(id));

    return {
      joined: filterViewport(filteredPeers.joined),
      viewable: filterViewport(filteredPeers.viewable),
      requestable: filteredPeers.requestable.filter(({ peer }) => viewportIdSet.has(peer.id)),
    };
  }, [viewportIds, filteredPeers]);

  const handleClose = useLastCallback(() => {
    closeCommunityPanel();
  });

  const handleTransitionEnd = useLastCallback((e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.propertyName !== 'transform') return;
    onCloseAnimationEnd?.();
  });

  const handleResetSearch = useLastCallback(() => {
    setSearchQuery('');
  });

  const handleOpenSearch = useLastCallback(() => {
    setIsScrolled(false);
    openSearch();
  });

  const handleCloseSearch = useLastCallback(() => {
    setIsScrolled(false);
    closeSearch();
    setSearchQuery('');
  });

  const handleBack = useLastCallback(() => {
    if (isSearchOpen) {
      handleCloseSearch();
      return;
    }

    handleClose();
  });

  const [joinCandidateId, setJoinCandidateId] = useState<string | undefined>();
  const joinCandidate = useMemo(
    () => requestablePeers.find(({ peer }) => peer.id === joinCandidateId),
    [requestablePeers, joinCandidateId],
  );

  const handleRequestableClick = useLastCallback((entry: RequestablePeerEntry) => {
    if (entry.isVisible === false) {
      showNotification({ message: lang('CommunityChatNotAccessible') });
      return;
    }

    // A bot chat is not joined, just opened
    if (isUserId(entry.peer.id)) {
      openChat({ id: entry.peer.id });
      return;
    }

    setJoinCandidateId(entry.peer.id);
  });

  const handleJoinConfirm = useLastCallback(() => {
    if (joinCandidateId) {
      joinChannel({ chatId: joinCandidateId });
    }
    setJoinCandidateId(undefined);
  });

  const closeJoinDialog = useLastCallback(() => {
    setJoinCandidateId(undefined);
  });

  const handleToggleCollapsed = useLastCallback(() => {
    if (!community) return;
    toggleCommunityCollapsed({ communityId: community.id });
  });

  useHistoryBack({
    isActive: isVisible,
    onBack: handleBack,
  });

  useEffect(() => (isVisible ? captureEscKeyListener(handleBack) : undefined), [handleBack, isVisible]);

  // With animations disabled `transitionend` never fires, so unmount explicitly
  useEffect(() => {
    if (!withInterfaceAnimations && !isOpen) {
      onCloseAnimationEnd?.();
    }
  }, [withInterfaceAnimations, isOpen, onCloseAnimationEnd]);

  useEffect(() => {
    if (prevIsVisible === isVisible) return;

    requestNextMutation(() => {
      if (!ref.current) return;

      const endHeavyAnimation = beginHeavyAnimation();
      waitForTransitionEnd(ref.current, endHeavyAnimation);

      onOpenAnimationStart?.();
      ref.current.style.transform = isVisible ? 'none' : '';
    });
  }, [isVisible, onOpenAnimationStart, prevIsVisible]);

  useEffect(() => {
    if (!IS_TOUCH_ENV) return undefined;

    return captureEvents(ref.current!, {
      selectorToPreventScroll: '.custom-scroll',
      onSwipe: (e, direction) => {
        const closeDirection = lang.isRtl ? SwipeDirection.Left : SwipeDirection.Right;
        if (direction === closeDirection) {
          handleBack();
          return true;
        }

        return false;
      },
    });
  }, [handleBack, lang.isRtl]);

  function renderPeers(peers: CommunityPeerEntry[]) {
    return peers.map((peer) => (
      <Chat
        key={peer.id}
        chatId={peer.id}
        className="standalone"
        noCommunityChevron
        isInCommunityPanel
        orderDiff={0}
        shiftDiff={0}
        animationType={ChatAnimationTypes.None}
      />
    ));
  }

  function renderSection(titleKey: 'CommunityChatsYouAreIn' | 'CommunityChatsYouCanView',
    peers: CommunityPeerEntry[]) {
    if (!peers.length) return undefined;

    return (
      <Island className={buildClassName(styles.island, styles.section)}>
        <h3 className={styles.sectionTitle}>{lang(titleKey)}</h3>
        {renderPeers(peers)}
      </Island>
    );
  }

  function renderRequestableSection(entries: RequestablePeerEntry[]) {
    if (!entries.length) return undefined;

    return (
      <Island className={buildClassName(styles.island, styles.section)}>
        <h3 className={styles.sectionTitle}>{lang('CommunityChatsYouCanJoin')}</h3>
        {entries.map((entry) => (
          <ListItem
            key={entry.peer.id}
            ripple
            onClick={() => handleRequestableClick(entry)}
          >
            <Avatar peer={entry.peer} size="medium" className={styles.requestableAvatar} />
            <div className={styles.requestableInfo}>
              <FullNameTitle peer={entry.peer} />
              {entry.peer.membersCount !== undefined && (
                <span className={styles.requestableSubtitle}>
                  {lang('NMembers', { count: entry.peer.membersCount }, { pluralValue: entry.peer.membersCount })}
                </span>
              )}
            </div>
          </ListItem>
        ))}
      </Island>
    );
  }

  if (!community) return undefined;

  const chatsCount = fullInfo?.linkedPeers?.length;

  return (
    <div
      ref={ref}
      className={buildClassName(
        styles.root,
        isScrolled && styles.scrolled,
        lang.isRtl && styles.rtl,
        !withInterfaceAnimations && styles.noAnimation,
      )}
      onTransitionEnd={!isOpen ? handleTransitionEnd : undefined}
    >
      <div className={buildClassName('left-header', styles.header)}>
        <Transition
          className={styles.headerTransition}
          name="slideFade"
          activeKey={isSearchOpen ? 1 : 0}
          shouldCleanup
        >
          {isSearchOpen ? (
            <div className={styles.searchHeader}>
              <Button
                round
                size="smaller"
                color="translucent"
                onClick={handleBack}
                ariaLabel={lang('Back')}
                iconName="arrow-left"
              />
              <SearchInput
                className={styles.headerSearchInput}
                value={searchQuery}
                autoFocusSearch
                placeholder={lang('CommunitySearchChats')}
                onChange={setSearchQuery}
                onReset={handleResetSearch}
              />
            </div>
          ) : (
            <div className={styles.headerContent}>
              <Button
                round
                size="smaller"
                color="translucent"
                onClick={handleBack}
                ariaLabel={lang('Close')}
                iconName="arrow-left"
              />
              <Avatar peer={community} size="small" />
              <div className={styles.headerInfo}>
                <FullNameTitle peer={community} />
                {chatsCount !== undefined && (
                  <span className={styles.headerSubtitle}>
                    {lang('CommunityChatsCount', { count: chatsCount }, { pluralValue: chatsCount })}
                  </span>
                )}
              </div>
              <Button
                round
                size="smaller"
                color="translucent"
                onClick={handleOpenSearch}
                ariaLabel={lang('Search')}
                iconName="search"
              />
            </div>
          )}
        </Transition>
      </div>

      <Transition
        className={styles.contentTransition}
        name="slideFade"
        activeKey={isSearchOpen ? 1 : 0}
        shouldCleanup
      >
        <Surface noPadding className={styles.surface}>
          <InfiniteScroll
            className={buildClassName('custom-scroll', styles.content)}
            items={viewportIds}
            preloadBackwards={COMMUNITY_CHATS_SLICE}
            // Children are grouped into sections rather than a flat keyed list
            noFastList
            onLoadMore={getMore}
            beforeChildren={!isSearchOpen ? (
              <Island className={styles.island}>
                <ListItem ripple onClick={handleToggleCollapsed}>
                  <span className={styles.toggleTitle}>{lang('CommunityShowAsOneChat')}</span>
                  <Switcher
                    label={lang('CommunityShowAsOneChat')}
                    checked={Boolean(community.isCollapsedInDialogs)}
                    inactive
                  />
                </ListItem>
                <IslandDescription className={styles.toggleHint}>
                  {lang('CommunityShowAsOneChatHint')}
                </IslandDescription>
              </Island>
            ) : undefined}
          >
            {!fullInfo ? (
              <Island className={buildClassName(styles.island, styles.loadingIsland)}>
                <Loading />
              </Island>
            ) : (
              <>
                {renderSection('CommunityChatsYouAreIn', viewportSections.joined)}
                {renderSection('CommunityChatsYouCanView', viewportSections.viewable)}
                {renderRequestableSection(viewportSections.requestable)}

                {!hasResults && (
                  <Island className={buildClassName(styles.island, styles.emptyIsland)}>
                    <p className={styles.empty}>{lang('CommunityNoChatsFound')}</p>
                  </Island>
                )}
              </>
            )}
          </InfiniteScroll>
        </Surface>
      </Transition>

      <ConfirmDialog
        isOpen={Boolean(joinCandidate)}
        title={joinCandidate?.peer.title}
        text={lang('CommunityJoinChatConfirm')}
        confirmLabel={lang('ChannelJoin')}
        confirmHandler={handleJoinConfirm}
        onClose={closeJoinDialog}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const communityId = selectCommunityPanelId(global);
    const community = communityId ? selectChat(global, communityId) : undefined;
    const fullInfo = communityId ? selectChatFullInfo(global, communityId) : undefined;

    return {
      community,
      fullInfo,
      withInterfaceAnimations: selectCanAnimateInterface(global),
    };
  },
  // Keep the last rendered community while the panel animates out
  (global) => Boolean(selectCommunityPanelId(global)),
)(CommunityPanel));

function sortByFreshest<T extends { date: number }>(peers: T[]) {
  return peers.sort((a, b) => b.date - a.date);
}
