import {
  memo, useMemo, useRef,
} from '../../lib/teact/teact';

import type { ApiFormattedText, ApiMessage, ApiStory } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { ThreadId } from '../../types';
import { ApiMessageEntityTypes } from '../../api/types';

import { extractMessageText, stripCustomEmoji } from '../../global/helpers';
import trimText from '../../util/trimText';
import { insertTextEntity, renderTextWithEntities } from './helpers/renderTextWithEntities';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useSyncEffect from '../../hooks/useSyncEffect';
import useUniqueId from '../../hooks/useUniqueId';

import TypingWrapper from './TypingWrapper';

interface OwnProps {
  messageOrStory: ApiMessage | ApiStory;
  threadId?: ThreadId;
  translatedText?: ApiFormattedText;
  isForAnimation?: boolean;
  emojiSize?: number;
  highlight?: string;
  asPreview?: boolean;
  truncateLength?: number;
  isProtected?: boolean;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  withTranslucentThumbs?: boolean;
  shouldRenderAsHtml?: boolean;
  inChatList?: boolean;
  forcePlayback?: boolean;
  focusedQuote?: string;
  focusedQuoteOffset?: number;
  isInSelectMode?: boolean;
  canBeEmpty?: boolean;
  maxTimestamp?: number;
  shouldAnimateTyping?: boolean;
}

const MIN_CUSTOM_EMOJIS_FOR_SHARED_CANVAS = 3;

function MessageText({
  messageOrStory,
  translatedText,
  isForAnimation,
  emojiSize,
  highlight,
  asPreview,
  truncateLength,
  isProtected,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  withTranslucentThumbs,
  shouldRenderAsHtml,
  inChatList,
  forcePlayback,
  focusedQuote,
  focusedQuoteOffset,
  isInSelectMode,
  canBeEmpty,
  maxTimestamp,
  threadId,
  shouldAnimateTyping,
}: OwnProps) {
  const sharedCanvasRef = useRef<HTMLCanvasElement>();
  const sharedCanvasHqRef = useRef<HTMLCanvasElement>();

  const textCacheBusterRef = useRef(0);

  const lang = useLang();

  const formattedText = translatedText || extractMessageText(messageOrStory, inChatList);
  const adaptedFormattedText = isForAnimation && formattedText ? stripCustomEmoji(formattedText) : formattedText;
  const { text, entities } = adaptedFormattedText || {};

  const entitiesWithFocusedQuote = useMemo(() => {
    if (!text || !focusedQuote) return entities;

    const offsetIndex = text.indexOf(focusedQuote, focusedQuoteOffset);
    const index = offsetIndex >= 0 ? offsetIndex : text.indexOf(focusedQuote); // Fallback to first occurrence
    const lendth = focusedQuote.length;
    if (index >= 0) {
      return insertTextEntity(entities || [], {
        offset: index,
        length: lendth,
        type: ApiMessageEntityTypes.QuoteFocus,
      });
    }

    return entities;
  }, [text, entities, focusedQuote, focusedQuoteOffset]);

  const containerId = useUniqueId();

  useSyncEffect(() => {
    textCacheBusterRef.current += 1;
  }, [text, entitiesWithFocusedQuote]);

  const withSharedCanvas = useMemo(() => {
    const hasSpoilers = entitiesWithFocusedQuote?.some((e) => e.type === ApiMessageEntityTypes.Spoiler);
    if (hasSpoilers) {
      return false;
    }

    const customEmojisCount = entitiesWithFocusedQuote
      ?.filter((e) => e.type === ApiMessageEntityTypes.CustomEmoji).length || 0;
    return customEmojisCount >= MIN_CUSTOM_EMOJIS_FOR_SHARED_CANVAS;
  }, [entitiesWithFocusedQuote]) || 0;

  const renderText = useLastCallback((t: ApiFormattedText) => {
    return renderTextWithEntities({
      text: t.text,
      entities: t.entities,
      highlight,
      emojiSize,
      shouldRenderAsHtml,
      containerId,
      asPreview,
      isProtected,
      observeIntersectionForLoading,
      observeIntersectionForPlaying,
      withTranslucentThumbs,
      sharedCanvasRef,
      sharedCanvasHqRef,
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
    entities: entitiesWithFocusedQuote,
  };

  return (
    <>
      {[
        withSharedCanvas && <canvas key="shared-canvas" ref={sharedCanvasRef} className="shared-canvas" />,
        withSharedCanvas && <canvas key="shared-canvas-hq" ref={sharedCanvasHqRef} className="shared-canvas" />,
        shouldAnimateTyping ? (
          <TypingWrapper key="typing-wrapper" text={textToRender}>{renderText}</TypingWrapper>
        ) : renderText(textToRender),
      ].flat().filter(Boolean)}
    </>
  );
}

export default memo(MessageText);
