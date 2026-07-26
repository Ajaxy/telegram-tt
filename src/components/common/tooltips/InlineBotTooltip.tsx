import { memo, useRef } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type {
  ApiBotInlineMediaResult, ApiBotInlineResult, ApiBotInlineSwitchPm, ApiBotInlineSwitchWebview,
} from '../../../api/types';
import { LoadMoreDirection } from '../../../types';

import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import { throttle } from '../../../util/schedulers';
import { extractCurrentThemeParams } from '../../../util/themeStyle';

import useFrozenProps from '../../../hooks/useFrozenProps';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';

import ArticleResult from '../../middle/composer/inlineResults/ArticleResult';
import GifResult from '../../middle/composer/inlineResults/GifResult';
import MediaResult from '../../middle/composer/inlineResults/MediaResult';
import StickerResult from '../../middle/composer/inlineResults/StickerResult';
import InfiniteScroll from '../../ui/InfiniteScroll';
import ListItem from '../../ui/ListItem';
import RichEditorTooltipPanel from './RichEditorTooltipPanel';

import styles from './InlineBotTooltip.module.scss';
import sharedStyles from './RichEditorTooltip.module.scss';

const INTERSECTION_DEBOUNCE_MS = 200;
const runThrottled = throttle((cb) => cb(), 500, true);

export type OwnProps = {
  isOpen: boolean;
  selectedIndex: number;
  botId?: string;
  isGallery?: boolean;
  inlineBotResults?: (ApiBotInlineResult | ApiBotInlineMediaResult)[];
  switchPm?: ApiBotInlineSwitchPm;
  switchWebview?: ApiBotInlineSwitchWebview;
  isSavedMessages?: boolean;
  canSendGifs?: boolean;
  onSelectResult: (
    inlineResult: ApiBotInlineMediaResult | ApiBotInlineResult, isSilent?: boolean, shouldSchedule?: boolean,
  ) => void;
  loadMore: NoneToVoidFunction;
  isCurrentUserPremium?: boolean;
};

const InlineBotTooltip = ({ isOpen, ...props }: OwnProps) => {
  const {
    selectedIndex,
    botId,
    isGallery,
    inlineBotResults,
    switchPm,
    switchWebview,
    isSavedMessages,
    canSendGifs,
    loadMore,
    onSelectResult,
    isCurrentUserPremium,
  } = useFrozenProps(props, !isOpen);

  const {
    openChat,
    startBot,
    requestSimpleWebView,
  } = getActions();

  const containerRef = useRef<HTMLDivElement>();
  const {
    observe: observeIntersection,
  } = useIntersectionObserver({
    rootRef: containerRef,
    debounceMs: INTERSECTION_DEBOUNCE_MS,
  });

  const handleLoadMore = useLastCallback(({ direction }: { direction: LoadMoreDirection }) => {
    if (direction === LoadMoreDirection.Backwards) {
      runThrottled(loadMore);
    }
  });

  const handleSendPm = useLastCallback(() => {
    openChat({ id: botId });
    startBot({ botId: botId!, param: switchPm!.startParam });
  });

  const handleOpenWebview = useLastCallback(() => {
    const theme = extractCurrentThemeParams();

    requestSimpleWebView({
      botId: botId!,
      url: switchWebview!.url,
      buttonText: switchWebview!.text,
      theme,
      isFromSwitchWebView: true,
    });
  });

  if (!(inlineBotResults?.length || switchPm || switchWebview)) {
    return undefined;
  }

  const className = buildClassName(
    sharedStyles.root,
    styles.root,
    'composer-tooltip',
    IS_TOUCH_ENV ? 'no-scrollbar' : 'custom-scroll',
    isGallery && styles.gallery,
  );

  function renderSwitchPm() {
    return (
      <ListItem ripple className={buildClassName(styles.switchPm, 'scroll-item')} onClick={handleSendPm}>
        <span className={styles.title}>{switchPm!.text}</span>
      </ListItem>
    );
  }

  function renderSwitchWebview() {
    return (
      <ListItem ripple className={buildClassName(styles.switchPm, 'scroll-item')} onClick={handleOpenWebview}>
        <span className={styles.title}>{switchWebview!.text}</span>
      </ListItem>
    );
  }

  function renderContent() {
    return inlineBotResults!.map((inlineBotResult, index) => {
      switch (inlineBotResult.type) {
        case 'gif':
          return (
            <GifResult
              key={inlineBotResult.id}
              inlineResult={inlineBotResult}
              observeIntersection={observeIntersection}
              onClick={onSelectResult}
              isSavedMessages={isSavedMessages}
              canSendGifs={canSendGifs}
            />
          );

        case 'photo':
          return (
            <MediaResult
              key={inlineBotResult.id}
              isForGallery={isGallery}
              inlineResult={inlineBotResult}
              onClick={onSelectResult}
            />
          );

        case 'sticker':
          return (
            <StickerResult
              key={inlineBotResult.id}
              inlineResult={inlineBotResult}
              observeIntersection={observeIntersection}
              onClick={onSelectResult}
              isSavedMessages={isSavedMessages}
              isCurrentUserPremium={isCurrentUserPremium}
            />
          );

        case 'video':
        case 'file':
        case 'game':
          return (
            <MediaResult
              key={inlineBotResult.id}
              focus={selectedIndex === index}
              inlineResult={inlineBotResult}
              onClick={onSelectResult}
            />
          );
        case 'article':
        case 'audio':
        case 'voice':
          return (
            <ArticleResult
              key={inlineBotResult.id}
              focus={selectedIndex === index}
              inlineResult={inlineBotResult}
              onClick={onSelectResult}
            />
          );

        default:
          return undefined;
      }
    });
  }

  return (
    <RichEditorTooltipPanel isOpen={isOpen}>
      <InfiniteScroll
        ref={containerRef}
        className={className}
        items={inlineBotResults}
        itemSelector=".chat-item-clickable"
        noFastList
        onLoadMore={handleLoadMore}
        sensitiveArea={160}
      >
        {switchPm && renderSwitchPm()}
        {switchWebview && renderSwitchWebview()}
        {Boolean(inlineBotResults?.length) && renderContent()}
      </InfiniteScroll>
    </RichEditorTooltipPanel>
  );
};

export default memo(InlineBotTooltip);
