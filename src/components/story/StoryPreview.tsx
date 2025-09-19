import { memo, useEffect, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiPeer, ApiPeerStories, ApiTypeStory,
} from '../../api/types';
import type { StoryViewerOrigin } from '../../types';

import { getStoryMediaHash } from '../../global/helpers';
import { getPeerTitle } from '../../global/helpers/peers';
import { selectTabState } from '../../global/selectors';
import renderText from '../common/helpers/renderText';

import useMedia from '../../hooks/useMedia';
import useOldLang from '../../hooks/useOldLang';

import Avatar from '../common/Avatar';
import MediaAreaOverlay from './mediaArea/MediaAreaOverlay';

import styles from './StoryViewer.module.scss';

interface OwnProps {
  peer?: ApiPeer;
  peerStories?: ApiPeerStories;
}

interface StateProps {
  lastViewedId?: number;
  origin?: StoryViewerOrigin;
  storyIdsForViewer?: number[];
}

function StoryPreview({
  peer, peerStories, lastViewedId, storyIdsForViewer, origin,
}: OwnProps & StateProps) {
  const { openStoryViewer, loadPeerSkippedStories } = getActions();
  const lang = useOldLang();

  const story = useMemo<ApiTypeStory | undefined>(() => {
    if (!peerStories) {
      return undefined;
    }

    const {
      orderedIds, lastReadId, byId,
    } = peerStories;
    const hasUnreadStories = orderedIds[orderedIds.length - 1] !== lastReadId;
    const previewIndexId = lastViewedId && storyIdsForViewer?.includes(lastViewedId)
      ? lastViewedId ?? (hasUnreadStories ? (lastReadId ?? -1) : -1)
      : -1;
    const resultId = byId[previewIndexId]?.id || storyIdsForViewer?.[0] || orderedIds[0];

    return byId[resultId];
  }, [lastViewedId, peerStories, storyIdsForViewer]);

  const isLoaded = story && 'content' in story;

  useEffect(() => {
    if (story && !isLoaded) {
      loadPeerSkippedStories({ peerId: story.peerId });
    }
  }, [story, isLoaded]);

  const video = isLoaded ? story.content.video : undefined;
  const imageHash = isLoaded ? getStoryMediaHash(story) : undefined;
  const imgBlobUrl = useMedia(imageHash);
  const thumbUrl = imgBlobUrl || video?.thumbnail?.dataUri;

  if (!peer || !story || 'isDeleted' in story) {
    return undefined;
  }

  return (
    <div
      className={styles.slideInner}
      onClick={() => { openStoryViewer({ peerId: story.peerId, storyId: story.id, origin }); }}
    >
      {thumbUrl && (
        <img src={thumbUrl} alt="" className={styles.media} draggable={false} />
      )}
      {isLoaded && <MediaAreaOverlay story={story} />}

      <div className={styles.content}>
        <div className={styles.contentInner}>
          <Avatar
            peer={peer}
            withStory
            storyViewerMode="disabled"
          />
          <div className={styles.name}>{renderText(getPeerTitle(lang, peer) || '')}</div>
        </div>
      </div>
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global, { peer }): Complete<StateProps> => {
  const {
    storyViewer: {
      lastViewedByPeerId: lastViewedByPeerIds,
      origin,
      storyList,
    },
  } = selectTabState(global);

  return {
    lastViewedId: peer?.id ? lastViewedByPeerIds?.[peer.id] : undefined,
    origin,
    storyIdsForViewer: peer?.id ? storyList?.storyIdsByPeerId[peer.id] : undefined,
  };
})(StoryPreview));
