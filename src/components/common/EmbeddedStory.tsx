import React, { useRef } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { FC } from '../../lib/teact/teact';
import type { ApiUser, ApiChat, ApiTypeStory } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';

import {
  getSenderTitle,
  getUserColorKey,
  getStoryMediaHash,
} from '../../global/helpers';
import renderText from './helpers/renderText';
import { getPictogramDimensions } from './helpers/mediaDimensions';
import buildClassName from '../../util/buildClassName';

import { useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useMedia from '../../hooks/useMedia';
import useLang from '../../hooks/useLang';
import { useFastClick } from '../../hooks/useFastClick';
import useLastCallback from '../../hooks/useLastCallback';

import './EmbeddedMessage.scss';

type OwnProps = {
  story?: ApiTypeStory;
  sender?: ApiUser | ApiChat;
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
        sender && !noUserColors && `color-${getUserColorKey(sender)}`,
      )}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    >
      {pictogramUrl && renderPictogram(pictogramUrl, isProtected)}
      <div className={buildClassName('message-text', isExpiredStory && 'with-message-color')}>
        <p dir="auto">
          {isExpiredStory && (
            <i className="icon icon-story-expired" aria-hidden />
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
