import React, {
  memo, useEffect, useMemo, useRef,
} from '../../lib/teact/teact';

import type { FC, TeactNode } from '../../lib/teact/teact';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';

import { IS_WEBM_SUPPORTED } from '../../util/environment';
import renderText from './helpers/renderText';
import safePlay from '../../util/safePlay';

import useMedia from '../../hooks/useMedia';
import useEnsureCustomEmoji from '../../hooks/useEnsureCustomEmoji';
import { useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useThumbnail from '../../hooks/useThumbnail';
import useCustomEmoji from './hooks/useCustomEmoji';

import AnimatedSticker from './AnimatedSticker';

type OwnProps = {
  documentId: string;
  children?: TeactNode;
  observeIntersection?: ObserveFn;
};

const STICKER_SIZE = 24;

const CustomEmojiInner: FC<OwnProps> = ({
  documentId,
  children,
  observeIntersection,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  // An alternative to `withGlobal` to avoid adding numerous global containers
  const customEmoji = useCustomEmoji(documentId);
  const mediaHash = customEmoji && `sticker${customEmoji.id}`;
  const mediaData = useMedia(mediaHash);
  const thumbDataUri = useThumbnail(customEmoji);

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  useEnsureCustomEmoji(documentId);

  useEffect(() => {
    if (!customEmoji?.isVideo) return;
    const video = ref.current?.querySelector('video');
    if (!video || isIntersecting === !video.paused) return;

    if (isIntersecting) {
      safePlay(video);
    } else {
      video.pause();
    }
  }, [customEmoji, isIntersecting]);

  const content = useMemo(() => {
    if (!customEmoji || (!thumbDataUri && !mediaData)) {
      return (children && renderText(children, ['emoji']));
    }
    if (!mediaData || (customEmoji.isVideo && !IS_WEBM_SUPPORTED)) {
      return (
        <img src={thumbDataUri} alt={customEmoji.emoji} />
      );
    }
    if (!customEmoji.isVideo && !customEmoji.isLottie) {
      return (
        <img src={mediaData} alt={customEmoji.emoji} />
      );
    }
    if (customEmoji.isVideo) {
      return (
        <video
          playsInline
          muted
          autoPlay={isIntersecting}
          loop
          src={mediaData}
        />
      );
    }
    return (
      <AnimatedSticker
        size={STICKER_SIZE}
        tgsUrl={mediaData}
        play={isIntersecting}
        isLowPriority
      />
    );
  }, [children, customEmoji, isIntersecting, mediaData, thumbDataUri]);

  return (
    <div ref={ref} className="text-entity-custom-emoji emoji">
      {content}
    </div>
  );
};

export default memo(CustomEmojiInner);
