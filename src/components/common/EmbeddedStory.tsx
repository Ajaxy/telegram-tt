import type { FC } from '../../lib/teact/teact';
import React, { useRef } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiPeer, ApiTypeStory } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';

import {
  getPeerColorKey,
  getSenderTitle,
  getStoryMediaHash,
} from '../../global/helpers';
import buildClassName from '../../util/buildClassName';
import { getPictogramDimensions } from './helpers/mediaDimensions';
import renderText from './helpers/renderText';

import { useFastClick } from '../../hooks/useFastClick';
import { useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useMedia from '../../hooks/useMedia';

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

  const lang = useLang();

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

  const senderTitle = sender ? getSenderTitle(lang, sender) : undefined;
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
    <div
      ref={ref}
      className={buildClassName(
        'EmbeddedMessage',
        sender && !noUserColors && `color-${getPeerColorKey(sender)}`,
      )}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    >
      {pictogramUrl && renderPictogram(pictogramUrl, isProtected)}
      <div className="message-text with-message-color">
        <p dir="auto">
          {isExpiredStory && (
            <i className="icon icon-story-expired" aria-hidden />
          )}
          {isFullStory && (
            <i className="icon icon-story-reply" aria-hidden />
          )}
          {lang(title)}
        </p>
        <div className="message-title" dir="auto">{renderText(senderTitle || NBSP)}</div>
      </div>
    </div>
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
