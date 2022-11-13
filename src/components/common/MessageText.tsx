import React, { memo, useMemo, useRef } from '../../lib/teact/teact';

import type { ApiMessage } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';

import { ApiMessageEntityTypes } from '../../api/types';
import trimText from '../../util/trimText';
import { getMessageText } from '../../global/helpers';
import { renderTextWithEntities } from './helpers/renderTextWithEntities';

interface OwnProps {
  message: ApiMessage;
  emojiSize?: number;
  highlight?: string;
  isSimple?: boolean;
  truncateLength?: number;
  isProtected?: boolean;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  withTranslucentThumbs?: boolean;
  shouldRenderAsHtml?: boolean;
}

const MIN_CUSTOM_EMOJIS_FOR_SHARED_CANVAS = 1;

function MessageText({
  message,
  emojiSize,
  highlight,
  isSimple,
  truncateLength,
  isProtected,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  withTranslucentThumbs,
  shouldRenderAsHtml,
}: OwnProps) {
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasHqRef = useRef<HTMLCanvasElement>(null);

  const { text, entities } = message.content.text || {};
  const withSharedCanvas = useMemo(() => {
    const hasSpoilers = entities?.some((e) => e.type === ApiMessageEntityTypes.Spoiler);
    if (hasSpoilers) {
      return false;
    }

    const customEmojisCount = entities?.filter((e) => e.type === ApiMessageEntityTypes.CustomEmoji).length || 0;
    return customEmojisCount >= MIN_CUSTOM_EMOJIS_FOR_SHARED_CANVAS;
  }, [entities]) || 0;

  if (!text) {
    const contentNotSupportedText = getMessageText(message);
    return contentNotSupportedText ? [trimText(contentNotSupportedText, truncateLength)] : undefined as any;
  }

  return (
    <>
      {[
        withSharedCanvas && <canvas ref={sharedCanvasRef} className="shared-canvas" />,
        withSharedCanvas && <canvas ref={sharedCanvasHqRef} className="shared-canvas" />,
        renderTextWithEntities(
          trimText(text!, truncateLength),
          entities,
          highlight,
          emojiSize,
          shouldRenderAsHtml,
          message.id,
          isSimple,
          isProtected,
          observeIntersectionForLoading,
          observeIntersectionForPlaying,
          withTranslucentThumbs,
          sharedCanvasRef,
          sharedCanvasHqRef,
        ),
      ].flat().filter(Boolean)}
    </>
  );
}

export default memo(MessageText);
