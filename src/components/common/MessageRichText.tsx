import { memo, useMemo, useRef, useState } from '../../lib/teact/teact';
import { getGlobal, getPromiseActions } from '../../global';

import type {
  ApiMessage,
  ApiPageBlock,
  ApiPageCaption,
  ApiPageListItem,
  ApiPageListOrderedItem,
  ApiRichText,
} from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { ThemeKey, ThreadId } from '../../types';

import { selectChatMessage } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import RichContent from '../iv/RichContent';
import Button from '../ui/Button';

import styles from './MessageRichText.module.scss';

type OwnProps = {
  message: ApiMessage;
  threadId?: ThreadId;
  isOwn?: boolean;
  noAvatars?: boolean;
  canAutoLoadMedia?: boolean;
  isProtected?: boolean;
  theme: ThemeKey;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
};

const MIN_CUSTOM_EMOJIS_FOR_SHARED_CANVAS = 3;

const MessageRichText = ({
  message,
  threadId,
  isOwn,
  noAvatars,
  canAutoLoadMedia,
  isProtected,
  theme,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
}: OwnProps) => {
  const { loadRichMessage } = getPromiseActions();

  const sharedCanvasRef = useRef<HTMLCanvasElement>();
  const sharedCanvasHqRef = useRef<HTMLCanvasElement>();
  const [expandedMessageKey, setExpandedMessageKey] = useState<string>();
  const [loadingMessageKey, setLoadingMessageKey] = useState<string>();
  const lang = useLang();

  const { richMessage } = message.content;
  const messageKey = `${message.chatId}-${message.id}`;
  const cutoff = richMessage?.partCutoff;
  const hasCutoff = cutoff !== undefined;
  const isExpanded = expandedMessageKey === messageKey;
  const isLoadingFullMessage = loadingMessageKey === messageKey;
  const shouldCollapse = !isExpanded && Boolean(richMessage?.isPart || hasCutoff);
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

    const customEmojisCount = countPageBlocksCustomEmojis(blocks);
    return customEmojisCount >= MIN_CUSTOM_EMOJIS_FOR_SHARED_CANVAS
      && !hasPageBlocksSpoileredCustomEmojis(blocks);
  }, [blocks, message.isTypingDraft]);

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

  if (!richMessage || !blocks) {
    return undefined;
  }

  return (
    <div className={styles.root}>
      <div className={shouldCollapse ? styles.collapsedContent : undefined}>
        {withSharedCanvas && <canvas key="shared-canvas" ref={sharedCanvasRef} className="shared-canvas" />}
        {withSharedCanvas && <canvas key="shared-canvas-hq" ref={sharedCanvasHqRef} className="shared-canvas" />}
        <RichContent
          blocks={blocks}
          isRtl={richMessage.isRtl}
          isOwn={isOwn}
          noAvatars={noAvatars}
          canAutoLoadMedia={canAutoLoadMedia}
          isProtected={isProtected}
          theme={theme}
          chatId={message.chatId}
          messageId={message.id}
          threadId={threadId}
          observeIntersectionForLoading={observeIntersectionForLoading}
          observeIntersectionForPlaying={observeIntersectionForPlaying}
          sharedCanvasRef={withSharedCanvas ? sharedCanvasRef : undefined}
          sharedCanvasHqRef={withSharedCanvas ? sharedCanvasHqRef : undefined}
        />
      </div>
      {shouldCollapse && (
        <div className={styles.readMoreWrapper}>
          <Button
            className={buildClassName(styles.readMoreButton, isOwn && styles.ownReadMoreButton)}
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

function countRichTextCustomEmojis(text: ApiRichText): number {
  switch (text.type) {
    case 'customEmoji':
      return 1;
    case 'concat':
      return text.texts.reduce((total, childText) => total + countRichTextCustomEmojis(childText), 0);
    case 'bold':
    case 'italic':
    case 'underline':
    case 'strike':
    case 'fixed':
    case 'url':
    case 'email':
    case 'subscript':
    case 'superscript':
    case 'marked':
    case 'phone':
    case 'anchor':
    case 'spoiler':
    case 'mention':
    case 'hashtag':
    case 'botCommand':
    case 'cashtag':
    case 'autoUrl':
    case 'autoEmail':
    case 'autoPhone':
    case 'bankCard':
    case 'mentionName':
    case 'date':
      return countRichTextCustomEmojis(text.text);
    default:
      return 0;
  }
}

function countPageBlocksCustomEmojis(blocks: ApiPageBlock[]): number {
  return sumPageBlocksMatchingRichText(blocks, countRichTextCustomEmojis);
}

function hasPageBlocksSpoileredCustomEmojis(blocks: ApiPageBlock[]): boolean {
  return hasPageBlocksMatchingRichText(blocks, hasRichTextSpoileredCustomEmojis);
}

function sumPageBlocksMatchingRichText(blocks: ApiPageBlock[], predicate: (text: ApiRichText) => number): number {
  return blocks.reduce((total, block) => total + sumPageBlockMatchingRichText(block, predicate), 0);
}

function hasPageBlocksMatchingRichText(blocks: ApiPageBlock[], predicate: (text: ApiRichText) => boolean): boolean {
  return blocks.some((block) => hasPageBlockMatchingRichText(block, predicate));
}

function sumPageBlockMatchingRichText(block: ApiPageBlock, predicate: (text: ApiRichText) => number): number {
  switch (block.type) {
    case 'unsupported':
    case 'divider':
    case 'anchor':
    case 'channel':
    case 'math':
      return 0;
    case 'title':
    case 'subtitle':
    case 'header':
    case 'subheader':
    case 'paragraph':
    case 'preformatted':
    case 'footer':
    case 'kicker':
    case 'heading1':
    case 'heading2':
    case 'heading3':
    case 'heading4':
    case 'heading5':
    case 'heading6':
    case 'thinking':
      return predicate(block.text);
    case 'authorDate':
      return predicate(block.author);
    case 'list':
    case 'orderedList':
      return sumPageListItemsMatchingRichText(block.items, predicate);
    case 'blockquote':
    case 'pullquote':
      return predicate(block.text) + predicate(block.caption);
    case 'blockquoteBlocks':
      return predicate(block.caption) + sumPageBlocksMatchingRichText(block.blocks, predicate);
    case 'photo':
    case 'video':
    case 'map':
    case 'audio':
    case 'embed':
      return sumPageCaptionMatchingRichText(block.caption, predicate);
    case 'cover':
      return sumPageBlockMatchingRichText(block.cover, predicate);
    case 'embedPost':
      return sumPageCaptionMatchingRichText(block.caption, predicate)
        + sumPageBlocksMatchingRichText(block.blocks, predicate);
    case 'collage':
    case 'slideshow':
      return sumPageCaptionMatchingRichText(block.caption, predicate)
        + block.items.reduce((total, item) => total + sumPageBlockMatchingRichText(item, predicate), 0);
    case 'details':
      return predicate(block.title) + sumPageBlocksMatchingRichText(block.blocks, predicate);
    case 'relatedArticles':
      return predicate(block.title);
    case 'table':
      return predicate(block.title) + block.rows.reduce((rowsTotal, row) => {
        return rowsTotal + row.cells.reduce((cellsTotal, cell) => {
          return cellsTotal + (cell.text ? predicate(cell.text) : 0);
        }, 0);
      }, 0);
  }
}

function hasPageBlockMatchingRichText(block: ApiPageBlock, predicate: (text: ApiRichText) => boolean): boolean {
  switch (block.type) {
    case 'unsupported':
    case 'divider':
    case 'anchor':
    case 'channel':
    case 'math':
      return false;
    case 'title':
    case 'subtitle':
    case 'header':
    case 'subheader':
    case 'paragraph':
    case 'preformatted':
    case 'footer':
    case 'kicker':
    case 'heading1':
    case 'heading2':
    case 'heading3':
    case 'heading4':
    case 'heading5':
    case 'heading6':
    case 'thinking':
      return predicate(block.text);
    case 'authorDate':
      return predicate(block.author);
    case 'list':
    case 'orderedList':
      return hasPageListItemsMatchingRichText(block.items, predicate);
    case 'blockquote':
    case 'pullquote':
      return predicate(block.text) || predicate(block.caption);
    case 'blockquoteBlocks':
      return predicate(block.caption)
        || hasPageBlocksMatchingRichText(block.blocks, predicate);
    case 'photo':
    case 'video':
    case 'map':
    case 'audio':
    case 'embed':
      return hasPageCaptionMatchingRichText(block.caption, predicate);
    case 'cover':
      return hasPageBlockMatchingRichText(block.cover, predicate);
    case 'embedPost':
      return hasPageCaptionMatchingRichText(block.caption, predicate)
        || hasPageBlocksMatchingRichText(block.blocks, predicate);
    case 'collage':
    case 'slideshow':
      return hasPageCaptionMatchingRichText(block.caption, predicate)
        || block.items.some((item) => hasPageBlockMatchingRichText(item, predicate));
    case 'details':
      return predicate(block.title) || hasPageBlocksMatchingRichText(block.blocks, predicate);
    case 'relatedArticles':
      return predicate(block.title);
    case 'table':
      return predicate(block.title) || block.rows.some((row) => {
        return row.cells.some((cell) => Boolean(cell.text && predicate(cell.text)));
      });
  }
}

function hasPageCaptionMatchingRichText(caption: ApiPageCaption, predicate: (text: ApiRichText) => boolean): boolean {
  return predicate(caption.text) || predicate(caption.credit);
}

function sumPageCaptionMatchingRichText(caption: ApiPageCaption, predicate: (text: ApiRichText) => number): number {
  return predicate(caption.text) + predicate(caption.credit);
}

function hasPageListItemsMatchingRichText(
  items: (ApiPageListItem | ApiPageListOrderedItem)[],
  predicate: (text: ApiRichText) => boolean,
): boolean {
  return items.some((item) => {
    return item.type === 'text'
      ? predicate(item.text)
      : hasPageBlocksMatchingRichText(item.blocks, predicate);
  });
}

function sumPageListItemsMatchingRichText(
  items: (ApiPageListItem | ApiPageListOrderedItem)[],
  predicate: (text: ApiRichText) => number,
): number {
  return items.reduce((total, item) => {
    return total + (item.type === 'text'
      ? predicate(item.text)
      : sumPageBlocksMatchingRichText(item.blocks, predicate));
  }, 0);
}

function hasRichTextSpoileredCustomEmojis(text: ApiRichText): boolean {
  switch (text.type) {
    case 'spoiler':
      return countRichTextCustomEmojis(text.text) > 0;
    case 'concat':
      return text.texts.some(hasRichTextSpoileredCustomEmojis);
    case 'bold':
    case 'italic':
    case 'underline':
    case 'strike':
    case 'fixed':
    case 'url':
    case 'email':
    case 'subscript':
    case 'superscript':
    case 'marked':
    case 'phone':
    case 'anchor':
    case 'mention':
    case 'hashtag':
    case 'botCommand':
    case 'cashtag':
    case 'autoUrl':
    case 'autoEmail':
    case 'autoPhone':
    case 'bankCard':
    case 'mentionName':
    case 'date':
      return hasRichTextSpoileredCustomEmojis(text.text);
    default:
      return false;
  }
}

export default memo(MessageRichText);
