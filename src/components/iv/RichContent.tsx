import type { ElementRef, TeactNode } from '../../lib/teact/teact';
import { memo, useCallback, useRef } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type {
  ApiGeoPoint,
  ApiPageBlock,
  ApiPageBlockBlockquote,
  ApiPageBlockBlockquoteBlocks,
  ApiPageBlockCollage,
  ApiPageBlockDetails,
  ApiPageBlockEmbed,
  ApiPageBlockMap,
  ApiPageBlockPhoto,
  ApiPageBlockPullquote,
  ApiPageBlockRelatedArticles,
  ApiPageBlockSlideshow,
  ApiPageBlockTable,
  ApiPageBlockVideo,
  ApiPageCaption,
  ApiPageListItem,
  ApiPageListOrderedItem,
  ApiPageRelatedArticle,
  ApiPageTableCell,
  ApiRichText,
  LinkContext,
} from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { LangFn } from '../../util/localization';
import { MediaViewerOrigin, type ThemeKey, type ThreadId } from '../../types';

import { DEBUG, TME_LINK_PREFIX } from '../../config';
import { getRichTextPlainText, hasRichText } from '../../global/helpers/richMessage';
import { IS_MAC_OS, IS_TOUCH_ENV } from '../../util/browser/windowEnvironment';
import buildClassName from '../../util/buildClassName';
import { formatDateTime } from '../../util/localization/dateFormat';
import renderText from '../common/helpers/renderText';
import {
  getPageMediaBlockMedia,
  getPageMediaBlocks,
  getPageMediaSourceId,
  getPageMediaSourceIds,
  type PageMediaBlock,
} from './helpers/pageMedia';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useScrollableHint from '../../hooks/useScrollableHint';
import useUniqueId from '../../hooks/useUniqueId';

import Blockquote from '../common/Blockquote';
import CodeBlock from '../common/code/CodeBlock';
import CompactMapPreview from '../common/CompactMapPreview';
import CompactMediaPreview from '../common/CompactMediaPreview';
import SafeLink from '../common/SafeLink';
import { Breakout } from '../gili/layout/Surface';
import Photo from '../middle/message/Photo';
import Video from '../middle/message/Video';
import Button from '../ui/Button';
import Collage from './Collage';
import EmbedFrame from './EmbedFrame';
import EmbedPost from './EmbedPost';
import Latex from './Latex';
import RichText, { getPageAnchorId } from './RichText';
import Slideshow from './Slideshow';
import Checkbox from '@gili/primitives/Checkbox';

import styles from './RichContent.module.scss';

const SHOULD_HIDE_SCROLLBARS = IS_MAC_OS || IS_TOUCH_ENV;

type OwnProps = {
  blocks: ApiPageBlock[];
  isRtl?: boolean;
  isOwn?: boolean;
  noAvatars?: boolean;
  canAutoLoadMedia?: boolean;
  isProtected?: boolean;
  theme: ThemeKey;
  pageUrl?: string;
  chatId?: string;
  messageId?: number;
  threadId?: ThreadId;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  sharedCanvasRef?: ElementRef<HTMLCanvasElement>;
  sharedCanvasHqRef?: ElementRef<HTMLCanvasElement>;
};

type RichTextContext = {
  unsupportedText: string;
  containerId: string;
  pageUrl?: string;
  chatId?: string;
  messageId?: number;
  threadId?: ThreadId;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  sharedCanvasRef?: ElementRef<HTMLCanvasElement>;
  sharedCanvasHqRef?: ElementRef<HTMLCanvasElement>;
};

const RELATED_ARTICLE_PHOTO_SIZE = 48;
const MAP_FALLBACK_WIDTH = 480;
const MAP_FALLBACK_HEIGHT = 360;

const RichContent = ({
  blocks,
  isRtl,
  isOwn,
  noAvatars,
  canAutoLoadMedia,
  isProtected,
  theme,
  pageUrl,
  chatId,
  messageId,
  threadId,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  sharedCanvasRef,
  sharedCanvasHqRef,
}: OwnProps) => {
  const {
    openMapModal, openMediaViewer, openUrl,
  } = getActions();

  const lang = useLang();
  const containerId = useUniqueId();
  const unsupportedText = lang('PageContentUnsupported');
  const embedTitle = lang('PageContentEmbed');

  const richTextContext: RichTextContext = {
    unsupportedText,
    containerId,
    pageUrl,
    chatId,
    messageId,
    threadId,
    observeIntersectionForLoading,
    observeIntersectionForPlaying,
    sharedCanvasRef,
    sharedCanvasHqRef,
  };

  const formatPublishedDate = useCallback((date: number) => {
    return formatDateTime(lang, new Date(date * 1000), { date: 'long' });
  }, [lang]);

  const handleOpenMap = useLastCallback((geoPoint: ApiGeoPoint, zoom: number) => {
    openMapModal({ geoPoint, zoom });
  });

  const handleOpenMediaLink = useLastCallback((block: ApiPageBlockPhoto) => {
    if (!block.url) {
      return false;
    }

    openUrl({
      url: block.url,
      tryInstant: true,
      previewId: block.webPageId,
      linkContext: getLinkContext(chatId, messageId, threadId),
    });

    return true;
  });

  const handleOpenMedia = useLastCallback((mediaBlocks: PageMediaBlock[], sourceIds: string[], mediaIndex: number) => {
    openMediaViewer({
      origin: messageId ? MediaViewerOrigin.RichPageBlock : MediaViewerOrigin.IVPageBlock,
      mediaIndex,
      pageMedia: {
        blocks: mediaBlocks,
        sourceIds,
        pageUrl,
        chatId,
        messageId,
        threadId,
        isProtected,
      },
    });
  });

  const renderContext: RenderBlockContext = {
    richTextContext,
    unsupportedText,
    isOwn,
    noAvatars,
    canAutoLoadMedia,
    isProtected,
    theme,
    observeIntersectionForLoading,
    observeIntersectionForPlaying,
    lang,
  };
  function renderTopLevelBlock(block: ApiPageBlock, index: number) {
    const sourceKey = String(index);
    const content = renderBlock(block, sourceKey, true);

    if (!isBreakoutMediaBlock(block)) {
      return content;
    }

    return (
      <Breakout className={styles.mediaBreakout}>
        {content}
      </Breakout>
    );
  }

  function renderBlock(block: ApiPageBlock, sourceKey: string, shouldBreakoutMedia = false): TeactNode {
    switch (block.type) {
      case 'title':
        return renderTextBlock(block.text, styles.title, renderContext);
      case 'subtitle':
        return renderTextBlock(block.text, styles.subtitle, renderContext);
      case 'kicker':
        return renderTextBlock(block.text, styles.kicker, renderContext);
      case 'authorDate':
        return (
          <p className={styles.authorDate}>
            <RichText text={block.author} {...richTextContext} />
            {block.publishedDate
              ? ` ${formatDateTime(lang, new Date(block.publishedDate * 1000), { date: 'long' })}`
              : undefined}
          </p>
        );
      case 'header':
      case 'heading1':
        return renderTextBlock(block.text, styles.heading1, renderContext);
      case 'subheader':
      case 'heading2':
        return renderTextBlock(block.text, styles.heading2, renderContext);
      case 'heading3':
        return renderTextBlock(block.text, styles.heading3, renderContext);
      case 'heading4':
      case 'heading5':
      case 'heading6':
        return renderTextBlock(block.text, styles.heading4, renderContext);
      case 'paragraph':
        return renderTextBlock(block.text, styles.paragraph, renderContext);
      case 'footer':
        return renderTextBlock(block.text, styles.footer, renderContext);
      case 'preformatted':
        return (
          <CodeBlock
            text={getRichTextPlainText(block.text)}
            language={block.language}
            noCopy={isProtected}
          />
        );
      case 'divider':
        return <hr className={styles.divider} />;
      case 'anchor':
        return <span id={getPageAnchorId(containerId, block.name)} />;
      case 'list':
        return (
          <ul className={styles.list}>
            {block.items.map((item, index) => (
              renderListItem(item, renderContext, `${sourceKey}-list-${index}`, renderBlock)
            ))}
          </ul>
        );
      case 'orderedList':
        if (block.items.some((item) => !item.num)) {
          return (
            <ol
              className={styles.list}
              start={block.start}
              reversed={block.isReversed}
              type={getOrderedListType(block.orderType)}
            >
              {block.items.map((item, index) => (
                renderNativeOrderedListItem(item, renderContext, `${sourceKey}-ordered-list-${index}`, renderBlock)
              ))}
            </ol>
          );
        }

        return (
          <ol className={buildClassName(styles.list, styles.orderedList)}>
            {block.items.map((item, index) => renderOrderedListItem(
              item, renderContext, `${sourceKey}-ordered-list-${index}`, renderBlock,
            ))}
          </ol>
        );
      case 'blockquote':
        return renderQuoteBlock(block, renderContext);
      case 'blockquoteBlocks':
        return renderBlockquoteBlocks(block, renderContext, sourceKey, renderBlock);
      case 'pullquote':
        return renderPullquoteBlock(block, renderContext);
      case 'cover':
        return (
          <Breakout className={buildClassName(styles.mediaBreakout, styles.cover)}>
            {renderBlock(block.cover, `${sourceKey}-cover`, true)}
          </Breakout>
        );
      case 'table':
        return (
          <TableBlock block={block} renderContext={renderContext} />
        );
      case 'photo':
        return renderPhotoBlock(
          block, renderContext, sourceKey, shouldBreakoutMedia, handleOpenMedia, handleOpenMediaLink,
        );
      case 'video':
        return renderVideoBlock(block, renderContext, sourceKey, shouldBreakoutMedia, handleOpenMedia);
      case 'math':
        return (
          <MathBlock source={block.source} />
        );
      case 'thinking':
        return renderTextBlock(block.text, styles.thinking, renderContext);
      case 'details':
        return renderDetailsBlock(block, renderContext, sourceKey, renderBlock);
      case 'map':
        return renderMapBlock(block, renderContext, handleOpenMap);
      case 'embed':
        return renderEmbedBlock(block, renderContext, embedTitle);
      case 'relatedArticles':
        return renderRelatedArticlesBlock(block, renderContext, formatPublishedDate);
      case 'collage':
        return renderCollageBlock(block, renderContext, sourceKey, shouldBreakoutMedia, handleOpenMedia);
      case 'slideshow':
        return renderSlideshowBlock(block, renderContext, sourceKey, shouldBreakoutMedia, handleOpenMedia);
      case 'channel':
        return <ChannelBlock channelUsername={block.channelUsername} title={block.title} />;
      case 'embedPost':
        return (
          <EmbedPost
            block={block}
            richTextContext={richTextContext}
            sourceKey={sourceKey}
            observeIntersectionForLoading={observeIntersectionForLoading}
            renderBlock={renderBlock}
          />
        );
      case 'audio':
      case 'unsupported':
        return renderUnsupportedBlock(unsupportedText, block.type);
    }
  }

  return (
    <div id={containerId} className={styles.richContent} dir={isRtl ? 'rtl' : 'auto'}>
      {blocks.map(renderTopLevelBlock)}
    </div>
  );
};

function getLinkContext(chatId?: string, messageId?: number, threadId?: ThreadId): LinkContext | undefined {
  if (!chatId || messageId === undefined) {
    return undefined;
  }

  return {
    type: 'message',
    chatId,
    messageId,
    threadId,
  };
}

type RenderBlockContext = {
  richTextContext: RichTextContext;
  unsupportedText: string;
  isOwn?: boolean;
  noAvatars?: boolean;
  canAutoLoadMedia?: boolean;
  isProtected?: boolean;
  theme: ThemeKey;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  lang: LangFn;
};

type RenderBlockFn = (block: ApiPageBlock, sourceKey: string) => TeactNode;
type OpenMapHandler = (geoPoint: ApiGeoPoint, zoom: number) => void;
type OpenMediaHandler = (mediaBlocks: PageMediaBlock[], sourceIds: string[], mediaIndex: number) => void;
type OpenMediaLinkHandler = (block: ApiPageBlockPhoto) => boolean;
type TableCellPosition = {
  isFirstRow: boolean;
  isLastRow: boolean;
  isFirstColumn: boolean;
  isLastColumn: boolean;
};

function isBreakoutMediaBlock(block: ApiPageBlock) {
  return block.type === 'photo'
    || block.type === 'video'
    || block.type === 'collage'
    || block.type === 'slideshow';
}

function TableBlock({
  block,
  renderContext,
}: {
  block: ApiPageBlockTable;
  renderContext: RenderBlockContext;
}) {
  const ref = useRef<HTMLDivElement>();

  useScrollableHint(ref);

  return (
    <div
      ref={ref}
      className={buildClassName(styles.tableWrapper, 'custom-scroll-x', SHOULD_HIDE_SCROLLBARS && 'no-scrollbar')}
    >
      {hasRichText(block.title) && renderTextBlock(block.title, styles.tableTitle, renderContext)}
      <table className={buildClassName(styles.table, block.isBordered && styles.bordered)}>
        <tbody>
          {block.rows.map((row, rowIndex) => {
            const isFirstRow = rowIndex === 0;
            const isLastRow = rowIndex === block.rows.length - 1;

            return (
              <tr className={block.isStriped && rowIndex % 2 ? styles.stripedRow : undefined}>
                {row.cells.map((cell, cellIndex) => renderTableCell(
                  cell,
                  renderContext,
                  {
                    isFirstRow,
                    isLastRow,
                    isFirstColumn: cellIndex === 0,
                    isLastColumn: cellIndex === row.cells.length - 1,
                  },
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MathBlock({ source }: { source: string }) {
  const ref = useRef<HTMLDivElement>();

  useScrollableHint(ref);

  return (
    <div
      ref={ref}
      className={buildClassName(
        styles.block, styles.latexBlockWrapper, 'custom-scroll-x', SHOULD_HIDE_SCROLLBARS && 'no-scrollbar',
      )}
    >
      <Latex source={source} isBlock />
    </div>
  );
}

function renderVideoBlock(
  block: ApiPageBlockVideo,
  context: RenderBlockContext,
  sourceKey: string,
  shouldBreakoutMedia: boolean,
  onOpenMedia: OpenMediaHandler,
) {
  const sourceId = getPageMediaSourceId(context.richTextContext.containerId, sourceKey, block);

  return (
    <figure className={styles.figure}>
      <Video
        id={sourceId}
        video={getPageMediaBlockMedia(block)}
        isOwn={context.isOwn}
        noAvatars={context.noAvatars}
        canAutoLoad={context.canAutoLoadMedia}
        canAutoPlay={block.isAutoplay && context.canAutoLoadMedia}
        isProtected={context.isProtected}
        observeIntersectionForLoading={context.observeIntersectionForLoading}
        observeIntersectionForPlaying={context.observeIntersectionForPlaying}
        isNestedMedia
        className={buildClassName(
          styles.mediaBlock,
          shouldBreakoutMedia && styles.fullWidthMediaBlock,
          shouldBreakoutMedia && styles.noBorderRadius,
        )}
        onClick={() => onOpenMedia([block], [sourceId], 0)}
      />
      {renderCaption(block.caption, context)}
    </figure>
  );
}

function renderPhotoBlock(
  block: ApiPageBlockPhoto,
  context: RenderBlockContext,
  sourceKey: string,
  shouldBreakoutMedia: boolean,
  onOpenMedia: OpenMediaHandler,
  onOpenMediaLink: OpenMediaLinkHandler,
) {
  if (!block.photo) {
    return renderUnsupportedBlock(context.unsupportedText, 'photo');
  }

  const sourceId = getPageMediaSourceId(context.richTextContext.containerId, sourceKey, block);

  return (
    <figure className={styles.figure}>
      <Photo
        id={sourceId}
        photo={getPageMediaBlockMedia(block)}
        isOwn={context.isOwn}
        noAvatars={context.noAvatars}
        canAutoLoad={context.canAutoLoadMedia}
        isProtected={context.isProtected}
        theme={context.theme}
        observeIntersection={context.observeIntersectionForLoading}
        isNestedMedia
        className={buildClassName(
          styles.mediaBlock,
          shouldBreakoutMedia && styles.fullWidthMediaBlock,
          shouldBreakoutMedia && styles.noBorderRadius,
        )}
        onClick={() => {
          if (!onOpenMediaLink(block)) {
            onOpenMedia([block], [sourceId], 0);
          }
        }}
      />
      {renderCaption(block.caption, context)}
    </figure>
  );
}

function renderSlideshowBlock(
  block: ApiPageBlockSlideshow,
  context: RenderBlockContext,
  sourceKey: string,
  shouldBreakoutMedia: boolean,
  onOpenMedia: OpenMediaHandler,
) {
  const items = getPageMediaBlocks(block.items);
  if (!items.length) {
    return renderCaption(block.caption, context) || <p className={styles.paragraph}>{context.lang('Album')}</p>;
  }

  const sourceIds = getPageMediaSourceIds(context.richTextContext.containerId, sourceKey, items);

  return (
    <figure className={styles.figure}>
      <Slideshow
        items={items}
        sourceIds={sourceIds}
        isOwn={context.isOwn}
        noAvatars={context.noAvatars}
        canAutoLoadMedia={context.canAutoLoadMedia}
        isProtected={context.isProtected}
        theme={context.theme}
        observeIntersectionForLoading={context.observeIntersectionForLoading}
        observeIntersectionForPlaying={context.observeIntersectionForPlaying}
        className={shouldBreakoutMedia ? styles.noBorderRadius : undefined}
        onMediaClick={(index) => onOpenMedia(items, sourceIds, index)}
        renderCaption={(caption) => renderCaption(caption, context)}
      />
      {renderCaption(block.caption, context)}
    </figure>
  );
}

function renderCollageBlock(
  block: ApiPageBlockCollage,
  context: RenderBlockContext,
  sourceKey: string,
  shouldBreakoutMedia: boolean,
  onOpenMedia: OpenMediaHandler,
) {
  const items = getPageMediaBlocks(block.items);
  if (!items.length) {
    return renderCaption(block.caption, context) || <p className={styles.paragraph}>{context.lang('Album')}</p>;
  }

  const sourceIds = getPageMediaSourceIds(context.richTextContext.containerId, sourceKey, items);

  return (
    <figure className={styles.figure}>
      <Collage
        items={items}
        sourceIds={sourceIds}
        isOwn={context.isOwn}
        noAvatars={context.noAvatars}
        canAutoLoadMedia={context.canAutoLoadMedia}
        isProtected={context.isProtected}
        theme={context.theme}
        observeIntersectionForLoading={context.observeIntersectionForLoading}
        observeIntersectionForPlaying={context.observeIntersectionForPlaying}
        className={shouldBreakoutMedia ? styles.noBorderRadius : undefined}
        onMediaClick={(index) => onOpenMedia(items, sourceIds, index)}
      />
      {renderCaption(block.caption, context)}
    </figure>
  );
}

function renderRelatedArticlesBlock(
  block: ApiPageBlockRelatedArticles,
  context: RenderBlockContext,
  formatPublishedDate: (date: number) => string,
) {
  if (!block.articles.length) {
    return undefined;
  }

  return (
    <section className={styles.relatedArticles}>
      {hasRichText(block.title) && (
        <h3 className={styles.relatedArticlesTitle}>
          <RichText text={block.title} {...context.richTextContext} />
        </h3>
      )}
      <div className={styles.relatedArticlesList}>
        {block.articles.map((article) => renderRelatedArticle(article, context, formatPublishedDate))}
      </div>
    </section>
  );
}

function renderRelatedArticle(
  article: ApiPageRelatedArticle,
  context: RenderBlockContext,
  formatPublishedDate: (date: number) => string,
) {
  const title = article.title || article.url;
  const publishedDate = article.publishedDate ? formatPublishedDate(article.publishedDate) : undefined;
  const meta = [article.author, publishedDate].filter(Boolean).join(' · ');

  return (
    <SafeLink
      key={article.url}
      url={article.url}
      text={title}
      className={styles.relatedArticle}
      chatId={context.richTextContext.chatId}
      messageId={context.richTextContext.messageId}
      threadId={context.richTextContext.threadId}
      previewId={article.webPageId}
      tryInstantView
    >
      <span className={styles.relatedArticleContent}>
        <span className={styles.relatedArticleTitle}>{renderText(title)}</span>
        {!meta && article.description && (
          <span className={styles.relatedArticleDescription}>{renderText(article.description)}</span>
        )}
        {meta && <span className={styles.relatedArticleMeta}>{meta}</span>}
      </span>
      {article.photo && (
        <CompactMediaPreview
          className={styles.relatedArticlePhoto}
          media={{ photo: article.photo }}
          size={RELATED_ARTICLE_PHOTO_SIZE}
          observeIntersectionForLoading={context.observeIntersectionForLoading}
        />
      )}
    </SafeLink>
  );
}

function renderTextBlock(
  text: ApiRichText,
  className: string,
  context: RenderBlockContext,
) {
  if (!hasRichText(text)) {
    return undefined;
  }

  return (
    <p className={buildClassName(styles.block, className)}>
      <RichText text={text} {...context.richTextContext} />
    </p>
  );
}

function renderQuoteBlock(
  block: ApiPageBlockBlockquote,
  context: RenderBlockContext,
) {
  return (
    <Blockquote className={styles.block}>
      <RichText text={block.text} {...context.richTextContext} />
      {hasRichText(block.caption) && (
        <footer className={styles.quoteCaption}>
          <RichText text={block.caption} {...context.richTextContext} />
        </footer>
      )}
    </Blockquote>
  );
}

function renderPullquoteBlock(
  block: ApiPageBlockPullquote,
  context: RenderBlockContext,
) {
  return (
    <aside className={buildClassName(styles.block, styles.pullquote)}>
      <RichText text={block.text} {...context.richTextContext} />
      {hasRichText(block.caption) && (
        <footer className={buildClassName(styles.quoteCaption, styles.pullquoteCaption)}>
          <RichText text={block.caption} {...context.richTextContext} />
        </footer>
      )}
    </aside>
  );
}

function renderBlockquoteBlocks(
  block: ApiPageBlockBlockquoteBlocks,
  context: RenderBlockContext,
  sourceKey: string,
  renderBlock: RenderBlockFn,
) {
  return (
    <Blockquote className={styles.block}>
      {block.blocks.map((nestedBlock, index) => renderBlock(nestedBlock, `${sourceKey}-quote-${index}`))}
      {hasRichText(block.caption) && (
        <footer className={styles.quoteCaption}>
          <RichText text={block.caption} {...context.richTextContext} />
        </footer>
      )}
    </Blockquote>
  );
}

function renderDetailsBlock(
  block: ApiPageBlockDetails,
  context: RenderBlockContext,
  sourceKey: string,
  renderBlock: RenderBlockFn,
) {
  return (
    <details className={styles.details} open={block.isOpen}>
      <summary className={styles.detailsSummary}>
        <RichText text={block.title} {...context.richTextContext} />
      </summary>
      <div className={styles.detailsContent}>
        {block.blocks.map((nestedBlock, index) => (
          renderBlock(nestedBlock, `${sourceKey}-details-${index}`)
        ))}
      </div>
    </details>
  );
}

function renderMapBlock(
  block: ApiPageBlockMap,
  context: RenderBlockContext,
  onOpenMap: OpenMapHandler,
) {
  const { geo } = block;

  if (!geo) {
    return renderUnsupportedBlock(context.unsupportedText, 'map');
  }

  return (
    <figure className={buildClassName(styles.figure, styles.centeredBlock)}>
      <CompactMapPreview
        className={styles.mapPreview}
        geo={geo}
        width={block.width || MAP_FALLBACK_WIDTH}
        height={block.height || MAP_FALLBACK_HEIGHT}
        zoom={block.zoom}
        shouldShowPin
        onClick={() => onOpenMap(geo, block.zoom)}
      />
      {renderCaption(block.caption, context)}
    </figure>
  );
}

function renderEmbedBlock(
  block: ApiPageBlockEmbed,
  context: RenderBlockContext,
  embedTitle: string,
) {
  return (
    <figure className={styles.figure}>
      <EmbedFrame
        block={block}
        title={embedTitle}
      />
      {renderCaption(block.caption, context)}
    </figure>
  );
}

function renderListItem(
  item: ApiPageListItem,
  context: RenderBlockContext,
  sourceKey: string,
  renderBlock: RenderBlockFn,
) {
  return (
    <li className={styles.listItem}>
      {renderCheckbox(item.isCheckbox, item.isChecked)}
      {item.type === 'text' ? (
        <RichText text={item.text} {...context.richTextContext} />
      ) : (
        item.blocks.map((block, index) => renderBlock(block, `${sourceKey}-${index}`))
      )}
    </li>
  );
}

function renderNativeOrderedListItem(
  item: ApiPageListOrderedItem,
  context: RenderBlockContext,
  sourceKey: string,
  renderBlock: RenderBlockFn,
) {
  return (
    <li
      className={styles.listItem}
      value={item.value}
      type={item.orderType}
    >
      {renderCheckbox(item.isCheckbox, item.isChecked)}
      {item.type === 'text' ? (
        <RichText text={item.text} {...context.richTextContext} />
      ) : (
        item.blocks.map((block, index) => renderBlock(block, `${sourceKey}-${index}`))
      )}
    </li>
  );
}

function renderOrderedListItem(
  item: ApiPageListOrderedItem,
  context: RenderBlockContext,
  sourceKey: string,
  renderBlock: RenderBlockFn,
) {
  return (
    <li className={buildClassName(styles.listItem, styles.orderedListItem)}>
      <span className={styles.orderedListMarker}>{`${item.num}.`}</span>
      <span className={styles.orderedListContent}>
        {renderCheckbox(item.isCheckbox, item.isChecked)}
        {item.type === 'text' ? (
          <RichText text={item.text} {...context.richTextContext} />
        ) : (
          item.blocks.map((block, index) => renderBlock(block, `${sourceKey}-${index}`))
        )}
      </span>
    </li>
  );
}

function getOrderedListType(orderType?: string) {
  switch (orderType) {
    case '1':
    case 'a':
    case 'A':
    case 'i':
    case 'I':
      return orderType;
    default:
      return undefined;
  }
}

function renderCheckbox(isCheckbox?: true, isChecked?: true) {
  if (!isCheckbox) {
    return undefined;
  }

  return (
    <span className={styles.checkboxWrapper}>
      <Checkbox checked={isChecked} nonInteractive />
    </span>
  );
}

function renderTableCell(
  cell: ApiPageTableCell,
  context: RenderBlockContext,
  position: TableCellPosition,
) {
  const CellTag = cell.isHeader ? 'th' : 'td';
  const className = buildClassName(
    styles.tableCell,
    cell.isHeader && styles.tableHeaderCell,
    position.isLastRow && styles.tableCellLastRow,
    position.isLastColumn && styles.tableCellLastColumn,
    position.isFirstRow && position.isFirstColumn && styles.tableCellTopLeft,
    position.isFirstRow && position.isLastColumn && styles.tableCellTopRight,
    position.isLastRow && position.isFirstColumn && styles.tableCellBottomLeft,
    position.isLastRow && position.isLastColumn && styles.tableCellBottomRight,
    cell.alignCenter && styles.alignCenter,
    cell.alignRight && styles.alignRight,
    cell.verticalAlignMiddle && styles.verticalAlignMiddle,
    cell.verticalAlignBottom && styles.verticalAlignBottom,
  );

  return (
    <CellTag
      className={className}
      colSpan={cell.colspan}
      rowSpan={cell.rowspan}
    >
      {cell.text && <RichText text={cell.text} {...context.richTextContext} />}
    </CellTag>
  );
}

function renderCaption(caption: ApiPageCaption, context: RenderBlockContext) {
  const hasText = hasRichText(caption.text);
  const hasCredit = hasRichText(caption.credit);
  if (!hasText && !hasCredit) {
    return undefined;
  }

  return (
    <figcaption className={styles.caption}>
      {hasText && <RichText text={caption.text} {...context.richTextContext} />}
      {hasCredit && (
        <span className={styles.credit}>
          <RichText text={caption.credit} {...context.richTextContext} />
        </span>
      )}
    </figcaption>
  );
}

function renderUnsupportedBlock(unsupportedText: string, blockType?: ApiPageBlock['type']) {
  return (
    <p className={styles.unsupported}>
      {unsupportedText}
      {DEBUG && blockType && `: ${blockType}`}
    </p>
  );
}

type ChannelBlockOwnProps = {
  channelUsername: string;
  title: string;
};

const ChannelBlock = ({
  channelUsername,
  title,
}: ChannelBlockOwnProps) => {
  const { openTelegramLink, closeInstantView } = getActions();
  const lang = useLang();
  const url = `${TME_LINK_PREFIX}${channelUsername}`;

  const handleClick = useLastCallback(() => {
    closeInstantView();
    openTelegramLink({ url });
  });

  return (
    <div className={styles.channelBlock}>
      <span className={styles.channelTitle} dir="auto">
        {renderText(title)}
      </span>
      <Button
        className={styles.channelButton}
        size="smaller"
        fluid
        isText
        onClick={handleClick}
      >
        {lang('ViewButtonChannel')}
      </Button>
    </div>
  );
};

export default memo(RichContent);
