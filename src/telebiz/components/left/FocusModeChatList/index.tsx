import { memo, useRef } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import { LeftColumnContent } from '../../../../types';
import { TelebizFeatureSection } from '../../../global/types';

import { CHAT_HEIGHT_PX, CHAT_LIST_SLICE } from '../../../../config';
import { selectTelebizOrderedPendingChatIds } from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { ChatAnimationTypes } from '../../../../components/left/main/hooks';

import useInfiniteScroll from '../../../../hooks/useInfiniteScroll';
import { useIntersectionObserver } from '../../../../hooks/useIntersectionObserver';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Chat from '../../../../components/left/main/Chat';
import Button from '../../../../components/ui/Button';
import InfiniteScroll from '../../../../components/ui/InfiniteScroll';

import styles from './FocusModeChatList.module.scss';

type OwnProps = {
  isActive: boolean;
  onReset: () => void;
};

type StateProps = {
  orderedChatIds: string[];
};

const INTERSECTION_THROTTLE = 200;

const FocusModeChatList = ({ orderedChatIds }: OwnProps & StateProps) => {
  const { openLeftColumnContent, telebizOpenFeaturesModal } = getActions();
  const lang = useTelebizLang();
  const containerRef = useRef<HTMLDivElement>();

  const chatsHeight = orderedChatIds.length * CHAT_HEIGHT_PX;

  const [viewportIds, getMore] = useInfiniteScroll(undefined, orderedChatIds, undefined, CHAT_LIST_SLICE);

  const { observe } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE,
  });

  function renderChats() {
    if (!viewportIds?.length) return undefined;

    const viewportOffset = orderedChatIds.indexOf(viewportIds[0]);

    return viewportIds.map((id, i) => {
      const offsetTop = (viewportOffset + i) * CHAT_HEIGHT_PX;

      return (
        <Chat
          key={id}
          teactOrderKey={i}
          chatId={id}
          isPinned={false}
          animationType={ChatAnimationTypes.None}
          orderDiff={0}
          offsetTop={offsetTop}
          observeIntersection={observe}
        />
      );
    });
  }

  const isEmpty = orderedChatIds.length === 0;

  return (
    <InfiniteScroll
      className={buildClassName('custom-scroll', styles.chatList)}
      ref={containerRef}
      items={viewportIds}
      itemSelector=".ListItem"
      preloadBackwards={CHAT_LIST_SLICE}
      withAbsolutePositioning
      maxHeight={chatsHeight}
      onLoadMore={getMore}
    >
      {isEmpty ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🎯</div>
          <div className={styles.emptyTitle}>All caught up!</div>
          <div className={styles.emptyText}>
            No pending tasks or follow-ups.
            <br />
            You&apos;re in the clear!
          </div>
          <Button
            color="primary"
            onClick={() => {
              openLeftColumnContent({ contentKey: LeftColumnContent.ChatList });
            }}
          >
            Go to Chat List
          </Button>
          <Button
            color="translucent"
            size="smaller"
            onClick={() => {
              telebizOpenFeaturesModal({ section: TelebizFeatureSection.FocusMode });
            }}
          >
            {lang('TelebizFeatures.LearnMoreShort')}
          </Button>
        </div>
      ) : (
        renderChats()
      )}
    </InfiniteScroll>
  );
};

export default memo(withGlobal<OwnProps>((global): StateProps => {
  return {
    orderedChatIds: selectTelebizOrderedPendingChatIds(global),
  };
})(FocusModeChatList));
