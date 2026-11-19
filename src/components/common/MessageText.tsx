import {
  memo, useMemo, useRef,
} from '../../lib/teact/teact';

import type {
  ApiFormattedText, ApiMessage, ApiMessageEntity, ApiStory,
} from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { ThreadId } from '../../types';
import { ApiMessageEntityTypes } from '../../api/types';

import { getIsGpuCanvasAvailable } from '../../lib/gpuCanvas/gpuCanvas';
import { extractMessageText, stripCustomEmoji } from '../../global/helpers';
import trimText from '../../util/text/trimText';
import { renderTextWithEntities } from './helpers/renderTextWithEntities';

import useDerivedState from '../../hooks/useDerivedState';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useSyncEffect from '../../hooks/useSyncEffect';
import useUniqueId from '../../hooks/useUniqueId';

import SharedCanvas from './SharedCanvas';
import TypingWrapper from './TypingWrapper';

interface OwnProps {
  messageOrStory: ApiMessage | ApiStory;
  threadId?: ThreadId;
  forcedText?: ApiFormattedText;
  isForAnimation?: boolean;
  emojiSize?: number;
  asPreview?: boolean;
  truncateLength?: number;
  isProtected?: boolean;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  withTranslucentThumbs?: boolean;
  shouldRenderAsHtml?: boolean;
  inChatList?: boolean;
  forcePlayback?: boolean;
  isInSelectMode?: boolean;
  canBeEmpty?: boolean;
  maxTimestamp?: number;
  shouldAnimateTyping?: boolean;
  noInitialTypingAnimation?: boolean;
  canAnimateTextStreaming?: boolean;
  onTypingAnimationEnd?: NoneToVoidFunction;
}

const MIN_CUSTOM_EMOJIS_FOR_SHARED_CANVAS = 3;

function MessageText({
  messageOrStory,
  forcedText,
  isForAnimation,
  emojiSize,
  asPreview,
  truncateLength,
  isProtected,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  withTranslucentThumbs,
  shouldRenderAsHtml,
  inChatList,
  forcePlayback,
  isInSelectMode,
  canBeEmpty,
  maxTimestamp,
  threadId,
  shouldAnimateTyping,
  noInitialTypingAnimation,
  canAnimateTextStreaming,
  onTypingAnimationEnd,
}: OwnProps) {
  const textCacheBusterRef = useRef(0);

  const lang = useLang();

  const formattedText = forcedText || extractMessageText(messageOrStory, inChatList);
  const adaptedFormattedText = isForAnimation && formattedText ? stripCustomEmoji(formattedText) : formattedText;
  const { text, entities } = adaptedFormattedText || {};

  const containerId = useUniqueId();

  useSyncEffect(() => {
    textCacheBusterRef.current += 1;
  }, [text, entities]);

  // Spoilers in previews cannot be revealed, so they keep static dots
  const canUseGpuCanvas = useDerivedState(getIsGpuCanvasAvailable) && !asPreview && !shouldRenderAsHtml;

  const withSharedCanvas = useMemo(() => {
    if (shouldAnimateTyping) {
      return false;
    }

    const customEmojisCount = countCustomEmojis(entities);
    if (canUseGpuCanvas) {
      return customEmojisCount >= MIN_CUSTOM_EMOJIS_FOR_SHARED_CANVAS || hasSpoilers(entities);
    }

    return customEmojisCount >= MIN_CUSTOM_EMOJIS_FOR_SHARED_CANVAS
      && !hasSpoileredCustomEmojis(entities);
  }, [entities, shouldAnimateTyping, canUseGpuCanvas]);
  const isGpuCanvas = withSharedCanvas && canUseGpuCanvas;

  const renderText = useLastCallback((t: ApiFormattedText) => {
    return renderTextWithEntities({
      text: t.text,
      entities: t.entities,
      emojiSize,
      shouldRenderAsHtml,
      containerId,
      asPreview,
      isProtected,
      observeIntersectionForLoading,
      observeIntersectionForPlaying,
      withTranslucentThumbs,
      cacheBuster: textCacheBusterRef.current.toString(),
      forcePlayback,
      isInSelectMode,
      maxTimestamp,
      chatId: 'chatId' in messageOrStory ? messageOrStory.chatId : undefined,
      messageId: messageOrStory.id,
      threadId,
    });
  });

  if (!text && !canBeEmpty) {
    return <span className="content-unsupported">{lang('MessageUnsupported')}</span>;
  }

  const textToRender: ApiFormattedText = {
    text: trimText(text || '', truncateLength),
    entities,
  };
  const shouldRenderTypingPlaceholder = !('previousLocalId' in messageOrStory) || !messageOrStory.previousLocalId;

  if (shouldAnimateTyping) {
    return (
      <TypingWrapper
        formattedText={textToRender}
        renderText={renderText}
        shouldAnimateMask={canAnimateTextStreaming}
        noInitialAnimation={noInitialTypingAnimation}
        shouldRenderPlaceholder={shouldRenderTypingPlaceholder}
        onCompleted={onTypingAnimationEnd}
        completionKey={messageOrStory.id}
      />
    );
  }

  if (withSharedCanvas) {
    return (
      <SharedCanvas isGpu={isGpuCanvas} contentKey={textCacheBusterRef.current}>
        {renderText(textToRender)}
      </SharedCanvas>
    );
  }

  return <>{renderText(textToRender)}</>;
}

function countCustomEmojis(entities?: ApiMessageEntity[]) {
  return entities?.filter((entity) => entity.type === ApiMessageEntityTypes.CustomEmoji).length || 0;
}

function hasSpoilers(entities?: ApiMessageEntity[]) {
  return Boolean(entities?.some((entity) => entity.type === ApiMessageEntityTypes.Spoiler));
}

function hasSpoileredCustomEmojis(entities?: ApiMessageEntity[]) {
  const spoilers = entities?.filter((entity) => entity.type === ApiMessageEntityTypes.Spoiler);
  if (!spoilers?.length) {
    return false;
  }

  return Boolean(entities?.some((entity) => {
    if (entity.type !== ApiMessageEntityTypes.CustomEmoji) {
      return false;
    }

    return spoilers.some((spoiler) => {
      return entity.offset >= spoiler.offset
        && entity.offset + entity.length <= spoiler.offset + spoiler.length;
    });
  }));
}

export default memo(MessageText);
