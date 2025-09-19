import type { FC } from '../../lib/teact/teact';
import {
  memo, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiStory, ApiTypeStoryView } from '../../api/types';

import {
  STORY_MIN_REACTIONS_SORT,
  STORY_VIEWS_MIN_CONTACTS_FILTER,
  STORY_VIEWS_MIN_SEARCH,
} from '../../config';
import {
  selectIsCurrentUserPremium,
  selectPeerStory,
  selectTabState,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { getServerTime } from '../../util/serverTime';
import renderText from '../common/helpers/renderText';

import useDebouncedCallback from '../../hooks/useDebouncedCallback';
import useFlag from '../../hooks/useFlag';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import useScrolledState from '../../hooks/useScrolledState';

import Icon from '../common/icons/Icon';
import Button from '../ui/Button';
import DropdownMenu from '../ui/DropdownMenu';
import InfiniteScroll from '../ui/InfiniteScroll';
import ListItem from '../ui/ListItem';
import MenuItem from '../ui/MenuItem';
import Modal from '../ui/Modal';
import PlaceholderChatInfo from '../ui/placeholder/PlaceholderChatInfo';
import SearchInput from '../ui/SearchInput';
import StoryView from './StoryView';

import styles from './StoryViewModal.module.scss';

interface StateProps {
  story?: ApiStory;
  isLoading?: boolean;
  views?: ApiTypeStoryView[];
  nextOffset?: string;
  viewersExpireDate?: number;
  isCurrentUserPremium?: boolean;
}

const REFETCH_DEBOUNCE = 250;

function StoryViewModal({
  story,
  viewersExpireDate,
  views,
  nextOffset,
  isLoading,
  isCurrentUserPremium,
}: StateProps) {
  const {
    loadStoryViewList, closeStoryViewModal, clearStoryViews,
  } = getActions();

  const [areJustContacts, markJustContacts, unmarkJustContacts] = useFlag(false);
  const [areReactionsFirst, markReactionsFirst, unmarkReactionsFirst] = useFlag(true);
  const [query, setQuery] = useState('');

  const lang = useOldLang();

  const isOpen = Boolean(story);
  const isExpired = Boolean(viewersExpireDate) && viewersExpireDate < getServerTime();
  const { viewsCount = 0, reactionsCount = 0 } = story?.views || {};

  const shouldShowJustContacts = story?.isPublic && viewsCount > STORY_VIEWS_MIN_CONTACTS_FILTER;
  const shouldShowSortByReactions = reactionsCount > STORY_MIN_REACTIONS_SORT;
  const shouldShowSearch = viewsCount > STORY_VIEWS_MIN_SEARCH;
  const hasHeader = shouldShowJustContacts || shouldShowSortByReactions || shouldShowSearch;

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      unmarkJustContacts();
      markReactionsFirst();
    }
  }, [isOpen]);

  const refetchViews = useDebouncedCallback(() => {
    clearStoryViews({ isLoading: true });
  }, [], REFETCH_DEBOUNCE, true);

  useEffect(() => {
    refetchViews();
  }, [areJustContacts, areReactionsFirst, query, refetchViews]);

  const sortedViews = useMemo(() => {
    return views?.sort(prepareComparator(areReactionsFirst));
  }, [areReactionsFirst, views]);

  const placeholderCount = !sortedViews?.length ? Math.min(viewsCount, 8) : 1;

  const notAllAvailable = Boolean(sortedViews?.length) && sortedViews.length < viewsCount && isExpired;

  const handleLoadMore = useLastCallback(() => {
    if (!story?.id || nextOffset === undefined) return;
    loadStoryViewList({
      peerId: story.peerId,
      storyId: story.id,
      offset: nextOffset,
      areReactionsFirst: areReactionsFirst || undefined,
      areJustContacts: areJustContacts || undefined,
      query,
    });
  });

  const { handleScroll, isAtBeginning } = useScrolledState();

  const handleClose = useLastCallback(() => {
    closeStoryViewModal();
  });

  const MoreMenuButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen: isMenuOpen }) => (
      <Button
        fluid
        size="tiny"
        color="translucent"
        className={buildClassName(!isMenuOpen && 'active', styles.sortButton, styles.topButton)}
        faded={isMenuOpen}
        onClick={onTrigger}
        ariaLabel={lang('SortBy')}
      >
        <Icon name={areReactionsFirst ? 'heart-outline' : 'recent'} className={styles.iconSort} />
        <Icon name="down" className={styles.iconDown} />
      </Button>
    );
  }, [areReactionsFirst, lang]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      className="component-theme-dark"
      contentClassName={styles.viewsList}
      isSlim
    >
      {hasHeader && (
        <div className={styles.header}>
          {shouldShowJustContacts && (
            <div className={styles.contactFilter}>
              <Button
                className={buildClassName(!areJustContacts && styles.selected, styles.topButton)}
                size="tiny"
                color="translucent-white"
                fluid
                onClick={unmarkJustContacts}
              >
                {lang('AllViewers')}
              </Button>
              <Button
                className={buildClassName(areJustContacts && styles.selected, styles.topButton)}
                size="tiny"
                color="translucent-white"
                fluid
                onClick={markJustContacts}
              >
                {lang('Contacts')}
              </Button>
            </div>
          )}
          {shouldShowSortByReactions && (
            <DropdownMenu
              className={styles.sort}
              trigger={MoreMenuButton}
              positionX="right"
            >
              <MenuItem icon="heart-outline" onClick={markReactionsFirst}>
                {lang('SortByReactions')}
                {areReactionsFirst && (
                  <Icon name="check" className={styles.check} />
                )}
              </MenuItem>
              <MenuItem icon="recent" onClick={unmarkReactionsFirst}>
                {lang('SortByTime')}
                {!areReactionsFirst && (
                  <Icon name="check" className={styles.check} />
                )}
              </MenuItem>
            </DropdownMenu>
          )}
          {shouldShowSearch && (
            <SearchInput className={styles.search} value={query} onChange={setQuery} />
          )}
        </div>
      )}
      <div
        className={buildClassName(styles.content, !isAtBeginning && styles.topScrolled, 'custom-scroll')}
        onScroll={handleScroll}
      >
        {isExpired && !isLoading && !query && Boolean(!sortedViews?.length) && (
          <div className={buildClassName(styles.info, styles.centeredInfo)}>
            {renderText(
              lang(isCurrentUserPremium ? 'ServerErrorViewers' : 'ExpiredViewsStub'),
              ['simple_markdown', 'emoji'],
            )}
          </div>
        )}
        {!isLoading && Boolean(query.length) && !sortedViews?.length && (
          <div className={styles.info}>
            {lang('Story.ViewList.EmptyTextSearch')}
          </div>
        )}
        <InfiniteScroll
          items={sortedViews}
          onLoadMore={handleLoadMore}
        >
          {sortedViews?.map((view) => {
            const additionalKeyId = view.type === 'forward' ? view.messageId
              : view.type === 'repost' ? view.storyId : 'user';
            return (
              <StoryView key={`${view.peerId}-${view.date}-${additionalKeyId}`} storyView={view} />
            );
          })}
          {isLoading && Array.from({ length: placeholderCount }).map((_, i) => (
            <ListItem

              key={`placeholder-${i}`}
              className="chat-item-clickable contact-list-item scroll-item small-icon"
              disabled
            >
              <PlaceholderChatInfo />
            </ListItem>
          ))}
          {notAllAvailable && (
            <div key="not-all-available" className={buildClassName(styles.info, styles.bottomInfo)}>
              {lang('Story.ViewList.NotFullyRecorded')}
            </div>
          )}
        </InfiniteScroll>
      </div>
      <div className={buildClassName(styles.footer, 'dialog-buttons')}>
        <Button
          className={buildClassName('confirm-dialog-button', styles.close)}
          isText
          onClick={handleClose}
        >
          {lang('Close')}
        </Button>
      </div>
    </Modal>
  );
}

function prepareComparator(areReactionsFirst?: boolean) {
  return (a: ApiTypeStoryView, b: ApiTypeStoryView) => {
    if (areReactionsFirst) {
      const reactionA = a.type === 'user' && a.reaction;
      const reactionB = b.type === 'user' && b.reaction;
      if (reactionA && !reactionB) {
        return -1;
      }
      if (!reactionA && reactionB) {
        return 1;
      }
    }

    return b.date - a.date;
  };
}

export default memo(withGlobal((global): Complete<StateProps> => {
  const { appConfig } = global;
  const { storyViewer: { viewModal } } = selectTabState(global);
  const {
    storyId, views, nextOffset, isLoading,
  } = viewModal || {};
  const story = storyId ? selectPeerStory(global, global.currentUserId!, storyId) : undefined;
  const storyExpireDate = story?.['@type'] === 'story' ? story.expireDate : undefined;

  return {
    views,
    viewersExpireDate: storyExpireDate ? (storyExpireDate + appConfig.storyViewersExpirePeriod) : undefined,
    story: story && 'content' in story ? story : undefined,
    nextOffset,
    isLoading,
    isCurrentUserPremium: selectIsCurrentUserPremium(global),
  };
})(StoryViewModal));
