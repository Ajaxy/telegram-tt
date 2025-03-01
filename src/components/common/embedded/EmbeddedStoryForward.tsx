import type { FC } from '../../../lib/teact/teact';
import React, { memo, useEffect, useRef } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiPeer,
  ApiStoryForwardInfo,
  ApiTypeStory,
} from '../../../api/types';
import type { IconName } from '../../../types/icons';

import {
  getPeerTitle,
  isUserId,
} from '../../../global/helpers';
import { selectPeer, selectPeerStory } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { getPeerColorClass } from '../helpers/peerColor';
import renderText from '../helpers/renderText';
import { renderTextWithEntities } from '../helpers/renderTextWithEntities';

import { useFastClick } from '../../../hooks/useFastClick';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Icon from '../icons/Icon';
import PeerColorWrapper from '../PeerColorWrapper';
import EmojiIconBackground from './EmojiIconBackground';

import './EmbeddedMessage.scss';

type OwnProps = {
  forwardInfo: ApiStoryForwardInfo;
  className?: string;
};

type StateProps = {
  sender?: ApiPeer;
  story?: ApiTypeStory;
};

const EmbeddedStoryForward: FC<OwnProps & StateProps> = ({
  className,
  forwardInfo,
  sender,
  story,
}) => {
  const { openStoryViewer, loadPeerStoriesByIds, openChat } = getActions();
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const lang = useOldLang();

  useEffect(() => {
    if (!story && forwardInfo.fromPeerId && forwardInfo.storyId) {
      loadPeerStoriesByIds({
        peerId: forwardInfo.fromPeerId,
        storyIds: [forwardInfo.storyId],
      });
    }
  }, [forwardInfo, story]);

  const senderTitle = sender ? getPeerTitle(lang, sender) : forwardInfo.fromName;

  const openOriginalStory = useLastCallback(() => {
    const { fromPeerId, storyId } = forwardInfo;
    if (!fromPeerId) return;

    const isStoryReady = story && !('isDeleted' in story && story.isDeleted);

    if (isStoryReady) {
      openStoryViewer({
        peerId: fromPeerId,
        storyId,
        isSingleStory: true,
      });
    } else {
      openChat({ id: fromPeerId });
    }
  });

  const { handleClick, handleMouseDown } = useFastClick(openOriginalStory);

  function renderTextContent() {
    if (story && 'content' in story && story.content.text) {
      return (
        <p className="embedded-text-wrapper">
          {renderTextWithEntities(story.content.text)}
        </p>
      );
    }

    return undefined;
  }

  function renderSender() {
    if (!sender || !senderTitle) {
      return undefined;
    }

    const icon: IconName | undefined = !isUserId(sender.id) ? 'channel-filled' : 'user-filled';

    return (
      <>
        {icon && <Icon name={icon} className="embedded-chat-icon" />}
        {senderTitle && renderText(senderTitle)}
      </>
    );
  }

  return (
    <PeerColorWrapper
      ref={ref}
      className={buildClassName(
        'EmbeddedMessage',
        className,
        getPeerColorClass(sender, true, true),
      )}
      dir={lang.isRtl ? 'rtl' : undefined}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    >
      {sender?.color?.backgroundEmojiId && (
        <EmojiIconBackground
          emojiDocumentId={sender.color.backgroundEmojiId}
          className="EmbeddedMessage--background-icons"
        />
      )}
      <div className="message-text">
        {renderTextContent()}
        <div className="message-title">
          {renderSender()}
        </div>
      </div>
    </PeerColorWrapper>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { forwardInfo }): StateProps => {
    const sender = forwardInfo.fromPeerId ? selectPeer(global, forwardInfo.fromPeerId) : undefined;
    const story = forwardInfo.storyId && forwardInfo.fromPeerId
      ? selectPeerStory(global, forwardInfo.fromPeerId, forwardInfo.storyId) : undefined;
    return {
      sender,
      story,
    };
  },
)(EmbeddedStoryForward));
