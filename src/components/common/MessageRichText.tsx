import { memo, useEffect, useMemo, useState } from '../../lib/teact/teact';
import { getGlobal, getPromiseActions } from '../../global';

import type {
  ApiMessage,
  ApiPageBlock,
  ApiRichMessage,
  ApiRichText,
} from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { ThemeKey, ThreadId } from '../../types';

import { RICH_CONTENT_BODY_FONT_SIZE_PX } from '../../config';
import { getIsGpuCanvasAvailable } from '../../lib/gpuCanvas/gpuCanvas';
import { isRichMediaMessage } from '../../global/helpers';
import { selectChatMessage } from '../../global/selectors';
import { selectMessageTextSize } from '../../global/selectors/sharedState';
import buildClassName from '../../util/buildClassName';
import { findRichQuoteRange, getRichQuoteTexts } from '../../util/text/richQuote';
import { forEachPageBlocksRichText, forEachRichTextNode } from '../../util/text/richText';

import useSelector from '../../hooks/data/useSelector';
import useDerivedState from '../../hooks/useDerivedState';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import RichContent from '../iv/RichContent';
import Button from '../ui/Button';
import SharedCanvas from './SharedCanvas';

import styles from './MessageRichText.module.scss';

type OwnProps = {
  message: ApiMessage;
  forcedRichMessage?: ApiRichMessage;
  focusedQuote?: string;
  focusedQuoteOffset?: number;
  threadId?: ThreadId;
  isOwn?: boolean;
  noAvatars?: boolean;
  canAutoLoadMedia?: boolean;
  isProtected?: boolean;
  noPlaylist?: boolean;
  theme: ThemeKey;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
};

const MIN_CUSTOM_EMOJIS_FOR_SHARED_CANVAS = 3;

const MessageRichText = ({
  message,
  forcedRichMessage,
  focusedQuote,
  focusedQuoteOffset,
  threadId,
  isOwn,
  noAvatars,
  canAutoLoadMedia,
  isProtected,
  noPlaylist,
  theme,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
}: OwnProps) => {
  const { loadRichMessage } = getPromiseActions();

  const [expandedMessageKey, setExpandedMessageKey] = useState<string>();
  const [loadingMessageKey, setLoadingMessageKey] = useState<string>();
  const messageTextSize = useSelector(selectMessageTextSize);
  const lang = useLang();
  const canUseGpuCanvas = useDerivedState(getIsGpuCanvasAvailable);

  const richMessage = forcedRichMessage || message.content.richMessage;
  const messageKey = `${message.chatId}-${message.id}`;
  const cutoff = richMessage?.partCutoff;
  const hasCutoff = cutoff !== undefined;
  const isExpanded = expandedMessageKey === messageKey && !richMessage?.isPart;
  const isLoadingFullMessage = loadingMessageKey === messageKey;
  const { quoteRange, shouldRevealQuote } = useMemo(() => {
    if (!focusedQuote || !richMessage) return {};
    const texts = getRichQuoteTexts(richMessage.blocks);
    const range = findRichQuoteRange(texts, focusedQuote, focusedQuoteOffset);
    const visibleCount = hasCutoff ? getRichQuoteTexts(richMessage.blocks.slice(0, cutoff)).length : texts.length;
    // A partial message may contain the quote in its unloaded part
    return { quoteRange: range, shouldRevealQuote: range ? range.last >= visibleCount : richMessage.isPart };
  }, [cutoff, focusedQuote, focusedQuoteOffset, hasCutoff, richMessage]);
  const shouldCollapse = !isExpanded && Boolean(richMessage?.isPart || (hasCutoff && !shouldRevealQuote));
  const shouldSliceBlocks = shouldCollapse && hasCutoff;
  const blocks = useMemo(() => {
    if (!richMessage) {
      return undefined;
    }

    return shouldSliceBlocks ? richMessage.blocks.slice(0, cutoff) : richMessage.blocks;
  }, [cutoff, richMessage, shouldSliceBlocks]);

  const withSharedCanvas = useMemo(() => {
    if (message.isTypingDraft || !blocks) {
      return false;
    }

    const { count, hasSpoilers, hasSpoilered } = getCustomEmojisInfo(blocks);
    if (canUseGpuCanvas) return count >= MIN_CUSTOM_EMOJIS_FOR_SHARED_CANVAS || hasSpoilers;

    return count >= MIN_CUSTOM_EMOJIS_FOR_SHARED_CANVAS && !hasSpoilered;
  }, [blocks, message.isTypingDraft, canUseGpuCanvas]);
  const isGpuCanvas = withSharedCanvas && canUseGpuCanvas;

  const handleShowMore = useLastCallback(() => {
    if (!richMessage?.isPart) {
      setExpandedMessageKey(messageKey);
      return;
    }

    setLoadingMessageKey(messageKey);
    void loadRichMessage({ chatId: message.chatId, messageId: message.id }).then(() => {
      const loadedRichMessage = selectChatMessage(getGlobal(), message.chatId, message.id)?.content.richMessage;
      if (!loadedRichMessage?.isPart) {
        setExpandedMessageKey(messageKey);
      }
    }).catch(() => {
      // Keep the partial message collapsed if loading the full rich message fails
    }).finally(() => {
      setLoadingMessageKey(undefined);
    });
  });

  useEffect(() => {
    if (shouldRevealQuote) handleShowMore();
  }, [shouldRevealQuote, handleShowMore]);

  if (!richMessage || !blocks) {
    return undefined;
  }

  const content = (
    <RichContent
      blocks={blocks}
      focusedQuoteRange={quoteRange}
      noQuoting={Boolean(forcedRichMessage)}
      isRtl={richMessage.isRtl}
      isOwn={isOwn}
      noAvatars={noAvatars}
      canAutoLoadMedia={canAutoLoadMedia}
      isProtected={isProtected}
      noPlaylist={noPlaylist}
      // Scheduled, ephemeral and draft messages have no media list, a translation can't be mapped to original blocks
      withMediaNavigation={isRichMediaMessage(message) && !forcedRichMessage
        && !message.isScheduled && !message.isEphemeral && !message.isTypingDraft}
      theme={theme}
      fontSizeAdjust={messageTextSize / RICH_CONTENT_BODY_FONT_SIZE_PX}
      chatId={message.chatId}
      messageId={message.id}
      threadId={threadId}
      observeIntersectionForLoading={observeIntersectionForLoading}
      observeIntersectionForPlaying={observeIntersectionForPlaying}
    />
  );

  return (
    <div className={buildClassName(styles.root, isOwn && styles.own)}>
      <div className={shouldCollapse ? styles.collapsedContent : undefined}>
        {withSharedCanvas ? (
          <SharedCanvas isGpu={isGpuCanvas} contentKey={blocks}>{content}</SharedCanvas>
        ) : content}
      </div>
      {shouldCollapse && (
        <div className={styles.readMoreWrapper}>
          <Button
            className={styles.readMoreButton}
            color="primary"
            isLoading={isLoadingFullMessage}
            pill
            fluid
            size="smaller"
            noForcedUpperCase
            onClick={handleShowMore}
          >
            {lang('RichMessageMore')}
          </Button>
        </div>
      )}
    </div>
  );
};

function getCustomEmojisInfo(blocks: ApiPageBlock[]) {
  let count = 0;
  let hasSpoilers = false;
  let hasSpoilered = false;

  const visit = (text: ApiRichText, isInSpoiler?: boolean) => forEachRichTextNode(text, (node) => {
    if (node.type === 'customEmoji') {
      count++;
      hasSpoilered ||= Boolean(isInSpoiler);
    } else if (node.type === 'spoiler' && !isInSpoiler) {
      hasSpoilers = true;
      visit(node.text, true);
      return false;
    }

    return true;
  });
  forEachPageBlocksRichText(blocks, (text) => visit(text));

  return { count, hasSpoilers, hasSpoilered };
}

export default memo(MessageRichText);
