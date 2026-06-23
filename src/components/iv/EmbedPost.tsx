import type { ElementRef, TeactNode } from '../../lib/teact/teact';
import { memo, useMemo } from '../../lib/teact/teact';

import type { ApiPageBlock, ApiPageBlockEmbedPost } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { ThreadId } from '../../types';

import { hasRichText } from '../../global/helpers/richMessage';
import { formatDateTime, secondsToDate } from '../../util/localization/dateFormat';
import { REM } from '../common/helpers/mediaDimensions';

import useLang from '../../hooks/useLang';

import CompactMediaPreview from '../common/CompactMediaPreview';
import PeerColorWrapper from '../common/PeerColorWrapper';
import RichText from './RichText';

import styles from './EmbedPost.module.scss';
import richContentStyles from './RichContent.module.scss';

const EMBED_POST_AVATAR_SIZE = 3 * REM;

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

type OwnProps = {
  block: ApiPageBlockEmbedPost;
  richTextContext: RichTextContext;
  sourceKey: string;
  observeIntersectionForLoading?: ObserveFn;
  renderBlock: (block: ApiPageBlock, sourceKey: string) => TeactNode;
};

const EmbedPost = ({
  block,
  richTextContext,
  sourceKey,
  observeIntersectionForLoading,
  renderBlock,
}: OwnProps) => {
  const lang = useLang();
  const avatarMedia = useMemo(() => ({ photo: block.authorPhoto }), [block.authorPhoto]);
  const hasCaptionText = hasRichText(block.caption.text);
  const hasCaptionCredit = hasRichText(block.caption.credit);

  return (
    <figure className={richContentStyles.figure}>
      <PeerColorWrapper className={styles.root}>
        <div className={styles.header}>
          <CompactMediaPreview
            className={styles.avatar}
            media={avatarMedia}
            size={EMBED_POST_AVATAR_SIZE}
            isRound
            observeIntersectionForLoading={observeIntersectionForLoading}
          />
          <div className={styles.author}>
            <div className={styles.authorName}>{block.author}</div>
            <div className={styles.date}>
              {formatDateTime(lang, secondsToDate(block.date), { date: 'long' })}
            </div>
          </div>
        </div>
        <div className={styles.content}>
          {block.blocks.map((nestedBlock, index) => renderBlock(nestedBlock, `${sourceKey}-post-${index}`))}
        </div>
        {(hasCaptionText || hasCaptionCredit) && (
          <div className={styles.source}>
            {hasCaptionText && <RichText text={block.caption.text} {...richTextContext} />}
            {hasCaptionCredit && (
              <span className={richContentStyles.credit}>
                <RichText text={block.caption.credit} {...richTextContext} />
              </span>
            )}
          </div>
        )}
      </PeerColorWrapper>
    </figure>
  );
};

export default memo(EmbedPost);
