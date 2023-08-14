import React, { memo, useEffect, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { selectStorySeenBy, selectTabState, selectUserStory } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { formatDateAtTime } from '../../util/dateFormat';
import { getServerTime } from '../../util/serverTime';
import renderText from '../common/helpers/renderText';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import usePrevious from '../../hooks/usePrevious';

import Modal from '../ui/Modal';
import ListItem from '../ui/ListItem';
import PrivateChatInfo from '../common/PrivateChatInfo';
import Button from '../ui/Button';
import Loading from '../ui/Loading';

import styles from './StoryViewer.module.scss';

interface StateProps {
  storyId?: number;
  storyDate?: number;
  viewsCount?: number;
  seenByDates?: Record<string, number>;
  viewersExpirePeriod: number;
}
const CLOSE_ANIMATION_DURATION = 100;

function StoryViewers({
  storyId,
  storyDate,
  viewsCount,
  viewersExpirePeriod,
  seenByDates,
}: StateProps) {
  const {
    loadStorySeenBy, openChat, closeStorySeenBy, closeStoryViewer,
  } = getActions();

  const lang = useLang();

  const isOpen = Boolean(storyId);
  const isExpired = Boolean(storyDate) && (storyDate + viewersExpirePeriod) < getServerTime();
  const renderingSeenByDates = useCurrentOrPrev(seenByDates, true);
  const renderingIsExpired = usePrevious(isExpired) || isExpired;
  const renderingViewsCount = useCurrentOrPrev(viewsCount, true);

  const memberIds = useMemo(() => {
    if (!renderingSeenByDates || renderingIsExpired) {
      return undefined;
    }

    const result = Object.keys(renderingSeenByDates);
    result.sort((leftId, rightId) => renderingSeenByDates[rightId] - renderingSeenByDates[leftId]);

    return result;
  }, [renderingIsExpired, renderingSeenByDates]);
  const isLoading = !renderingIsExpired && (!memberIds || memberIds.length === 0);

  useEffect(() => {
    if (!storyId || seenByDates || renderingIsExpired) {
      return;
    }

    // TODO Infinite scroll
    loadStorySeenBy({ storyId });
  }, [renderingIsExpired, seenByDates, storyId]);

  const handleCloseSeenByModal = useLastCallback(() => {
    closeStorySeenBy();
  });

  const handleClick = useLastCallback((userId: string) => {
    closeStorySeenBy();
    closeStoryViewer();

    setTimeout(() => {
      openChat({ id: userId });
    }, CLOSE_ANIMATION_DURATION);
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeStorySeenBy}
      className={buildClassName(styles.modal, 'narrow', 'component-theme-dark')}
      title={isLoading ? 'Loading...' : `Seen by ${renderingViewsCount} users`}
    >
      <div
        dir={lang.isRtl ? 'rtl' : undefined}
        className={buildClassName(styles.seenByList, isLoading && styles.seenByListLoading)}
      >
        {isLoading && <Loading />}
        {renderingIsExpired && (
          <div className={styles.expiredText}>
            {renderText(lang('ExpiredViewsStub'), ['simple_markdown', 'emoji'])}
          </div>
        )}
        {memberIds?.map((userId) => (
          <ListItem
            key={userId}
            className="chat-item-clickable contact-list-item scroll-item small-icon"
            // eslint-disable-next-line react/jsx-no-bind
            onClick={() => handleClick(userId)}
          >
            <PrivateChatInfo
              userId={userId}
              noStatusOrTyping
              status={formatDateAtTime(lang, renderingSeenByDates![userId] * 1000)}
              statusIcon="icon-message-read"
              withStory
            />
          </ListItem>
        ))}
      </div>
      <div className="dialog-buttons mt-2">
        <Button
          className="confirm-dialog-button"
          isText
          onClick={handleCloseSeenByModal}
        >
          {lang('Close')}
        </Button>
      </div>
    </Modal>
  );
}

export default memo(withGlobal((global) => {
  const { appConfig } = global;
  const { storyViewer: { storyIdSeenBy } } = selectTabState(global);
  const story = storyIdSeenBy ? selectUserStory(global, global.currentUserId!, storyIdSeenBy) : undefined;
  const storyDate = story && 'date' in story ? story.date : undefined;
  const viewsCount = story && 'viewsCount' in story ? story.viewsCount : undefined;

  return {
    storyId: storyIdSeenBy,
    seenByDates: storyIdSeenBy ? selectStorySeenBy(global, global.currentUserId!, storyIdSeenBy) : undefined,
    viewersExpirePeriod: appConfig!.storyExpirePeriod + appConfig!.storyViewersExpirePeriod,
    storyDate,
    viewsCount,
  };
})(StoryViewers));
