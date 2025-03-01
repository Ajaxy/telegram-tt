import type { FC } from '../../../lib/teact/teact';
import React, { useRef } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiPeer, ApiTypeStory } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';

import {
  getPeerTitle,
  getStoryMediaHash,
} from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import { getPictogramDimensions } from '../helpers/mediaDimensions';
import renderText from '../helpers/renderText';

import { useFastClick } from '../../../hooks/useFastClick';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';
import useOldLang from '../../../hooks/useOldLang';

import Icon from '../icons/Icon';
import PeerColorWrapper from '../PeerColorWrapper';

import './EmbeddedMessage.scss';

type OwnProps = {
  story?: ApiTypeStory;
  sender?: ApiPeer;
  noUserColors?: boolean;
  isProtected?: boolean;
  observeIntersectionForLoading?: ObserveFn;
  onClick: NoneToVoidFunction;
};

const NBSP = '\u00A0';

const EmbeddedStory: FC<OwnProps> = ({
  story,
  sender,
  noUserColors,
  isProtected,
  observeIntersectionForLoading,
  onClick,
}) => {
  const { showNotification } = getActions();

  const lang = useOldLang();

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  const isIntersecting = useIsIntersecting(ref, observeIntersectionForLoading);
  const isFullStory = story && 'content' in story;
  const isExpiredStory = story && 'isDeleted' in story;
  const isVideoStory = isFullStory && Boolean(story.content.video);
  const title = isFullStory ? 'Story' : (isExpiredStory ? 'ExpiredStory' : 'Loading');

  const mediaBlobUrl = useMedia(isFullStory && getStoryMediaHash(story, 'pictogram'), !isIntersecting);
  const mediaThumbnail = isVideoStory ? story.content.video!.thumbnail?.dataUri : undefined;
  const pictogramUrl = mediaBlobUrl || mediaThumbnail;

  const senderTitle = sender ? getPeerTitle(lang, sender) : undefined;
  const handleFastClick = useLastCallback(() => {
    if (story && !isExpiredStory) {
      onClick();
    } else {
      showNotification({
        message: lang('StoryNotFound'),
      });
    }
  });

  const { handleClick, handleMouseDown } = useFastClick(handleFastClick);

  return (
    <PeerColorWrapper
      ref={ref}
      peerColor={sender?.color}
      noUserColors={noUserColors}
      shouldReset
      className={buildClassName(
        'EmbeddedMessage',
        pictogramUrl && 'with-thumb',
      )}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    >
      {pictogramUrl && renderPictogram(pictogramUrl, isProtected)}
      <div className="message-text with-message-color">
        <p className="embedded-text-wrapper">
          {isExpiredStory && (
            <Icon name="story-expired" className="embedded-origin-icon" />
          )}
          {isFullStory && (
            <Icon name="story-reply" className="embedded-origin-icon" />
          )}
          {lang(title)}
        </p>
        <div className="message-title">{renderText(senderTitle || NBSP)}</div>
      </div>
    </PeerColorWrapper>
  );
};

function renderPictogram(
  srcUrl: string,
  isProtected?: boolean,
) {
  const { width, height } = getPictogramDimensions();

  return (
    <div className="embedded-thumb">
      <img
        src={srcUrl}
        width={width}
        height={height}
        alt=""
        className="pictogram"
        draggable={false}
      />
      {isProtected && <span className="protector" />}
    </div>
  );
}

export default EmbeddedStory;
