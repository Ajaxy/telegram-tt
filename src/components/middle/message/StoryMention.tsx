import React, { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiMessage, ApiPeer, ApiTypeStory, ApiUser,
} from '../../../api/types';

import { getSenderTitle, getStoryMediaHash, getUserFirstOrLastName } from '../../../global/helpers';
import {
  selectPeer,
  selectPeerStories,
  selectPeerStory,
  selectUser,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import renderText from '../../common/helpers/renderText';

import useEnsureStory from '../../../hooks/useEnsureStory';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';

interface OwnProps {
  message: ApiMessage;
}

interface StateProps {
  story?: ApiTypeStory;
  peer?: ApiPeer;
  targetUser?: ApiUser;
  isUnread?: boolean;
}

function StoryMention({
  message, story, peer, isUnread, targetUser,
}: OwnProps & StateProps) {
  const { openStoryViewer } = getActions();

  const lang = useLang();

  const { storyData } = message.content;

  const handleClick = useLastCallback(() => {
    openStoryViewer({
      peerId: story!.peerId,
      storyId: story!.id,
      isSinglePeer: true,
      isSingleStory: true,
    });
  });

  const isDeleted = story && 'isDeleted' in story;
  const isLoaded = story && 'content' in story;
  const video = isLoaded ? story.content.video : undefined;
  const imageHash = isLoaded
    ? getStoryMediaHash(story, 'pictogram')
    : undefined;
  const imgBlobUrl = useMedia(imageHash);
  const thumbUrl = imgBlobUrl || video?.thumbnail?.dataUri;

  useEnsureStory(storyData!.peerId, storyData!.id, story);

  function getTitle() {
    if (peer && 'isSelf' in peer && peer.isSelf) {
      return isDeleted
        ? lang('ExpiredStoryMentioned', getUserFirstOrLastName(targetUser))
        : lang('StoryYouMentionedTitle', getUserFirstOrLastName(targetUser));
    }

    return isDeleted
      ? lang('ExpiredStoryMention')
      : lang('StoryMentionedTitle', getSenderTitle(lang, peer!));
  }

  return (
    <div
      className={buildClassName('action-message-story-mention', isUnread && 'is-unread', isLoaded && 'with-preview')}
      tabIndex={0}
      role="button"
      onClick={isLoaded ? handleClick : undefined}
    >
      {isLoaded && (
        <span className="story-media-wrapper">
          {thumbUrl && (
            <img src={thumbUrl} alt="" className="story-media" />
          )}
        </span>
      )}

      <span className="story-title">{renderText(getTitle(), ['emoji', 'simple_markdown'])}</span>
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global, { message }): StateProps => {
  const { id, peerId } = message.content.storyData!;
  const lastReadId = selectPeerStories(global, peerId)?.lastReadId;

  return {
    story: selectPeerStory(global, peerId, id),
    peer: selectPeer(global, peerId),
    targetUser: selectUser(global, message.chatId),
    isUnread: Boolean(lastReadId && lastReadId < id),
  };
})(StoryMention));
