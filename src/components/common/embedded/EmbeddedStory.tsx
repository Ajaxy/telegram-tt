import type { FC } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiPeer, ApiTypeStory } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';

import { getPeerTitle } from '../../../global/helpers/peers';
import buildClassName from '../../../util/buildClassName';
import renderText from '../helpers/renderText';

import { useFastClick } from '../../../hooks/useFastClick';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import CompactMediaPreview, { canRenderCompactMediaPreview } from '../CompactMediaPreview';
import Icon from '../icons/Icon';
import PeerColorWrapper from '../PeerColorWrapper';

import './EmbeddedMessage.scss';

type OwnProps = {
  story?: ApiTypeStory;
  sender?: ApiPeer;
  noUserColors?: boolean;
  isProtected?: boolean;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  onClick: NoneToVoidFunction;
};

const NBSP = '\u00A0';

const EmbeddedStory: FC<OwnProps> = ({
  story,
  sender,
  noUserColors,
  isProtected,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  onClick,
}) => {
  const { showNotification } = getActions();

  const lang = useOldLang();
  const isFullStory = story && 'content' in story;
  const isExpiredStory = story && 'isDeleted' in story;
  const title = isFullStory ? 'Story' : (isExpiredStory ? 'ExpiredStory' : 'Loading');

  const hasPictogram = isFullStory && canRenderCompactMediaPreview(story.content);

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
      peerColor={sender?.color}
      noUserColors={noUserColors}
      shouldReset
      className={buildClassName(
        'EmbeddedMessage',
        hasPictogram && 'with-thumb',
      )}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    >
      {isFullStory && hasPictogram && (
        <CompactMediaPreview
          media={story.content}
          className="embedded-thumb"
          isPictogram
          isProtected={isProtected}
          observeIntersectionForLoading={observeIntersectionForLoading}
          observeIntersectionForPlaying={observeIntersectionForPlaying}
        />
      )}
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

export default EmbeddedStory;
