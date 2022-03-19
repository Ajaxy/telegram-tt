import React, {
  FC, memo, useCallback, useEffect, useRef,
} from '../../../lib/teact/teact';

import { ApiBotInlineMediaResult, ApiBotInlineResult, ApiBotInlineSwitchPm } from '../../../api/types';
import { LoadMoreDirection } from '../../../types';

import { IS_TOUCH_ENV } from '../../../util/environment';
import setTooltipItemVisible from '../../../util/setTooltipItemVisible';
import buildClassName from '../../../util/buildClassName';
import useShowTransition from '../../../hooks/useShowTransition';
import { throttle } from '../../../util/schedulers';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import usePrevious from '../../../hooks/usePrevious';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';

import MediaResult from './inlineResults/MediaResult';
import ArticleResult from './inlineResults/ArticleResult';
import GifResult from './inlineResults/GifResult';
import StickerResult from './inlineResults/StickerResult';
import ListItem from '../../ui/ListItem';
import InfiniteScroll from '../../ui/InfiniteScroll';

import './InlineBotTooltip.scss';
import { getActions } from '../../../modules';

const INTERSECTION_DEBOUNCE_MS = 200;
const runThrottled = throttle((cb) => cb(), 500, true);

export type OwnProps = {
  isOpen: boolean;
  botId?: string;
  isGallery?: boolean;
  inlineBotResults?: (ApiBotInlineResult | ApiBotInlineMediaResult)[];
  switchPm?: ApiBotInlineSwitchPm;
  onSelectResult: (inlineResult: ApiBotInlineMediaResult | ApiBotInlineResult) => void;
  loadMore: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
};

const InlineBotTooltip: FC<OwnProps> = ({
  isOpen,
  botId,
  isGallery,
  inlineBotResults,
  switchPm,
  loadMore,
  onClose,
  onSelectResult,
}) => {
  const {
    openChat,
    startBot,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldRender, transitionClassNames } = useShowTransition(isOpen, undefined, undefined, false);
  const {
    observe: observeIntersection,
  } = useIntersectionObserver({
    rootRef: containerRef,
    debounceMs: INTERSECTION_DEBOUNCE_MS,
    isDisabled: !isOpen,
  });

  const handleLoadMore = useCallback(({ direction }: { direction: LoadMoreDirection }) => {
    if (direction === LoadMoreDirection.Backwards) {
      runThrottled(loadMore);
    }
  }, [loadMore]);

  const selectedIndex = useKeyboardNavigation({
    isActive: isOpen,
    shouldRemoveSelectionOnReset: isGallery,
    noArrowNavigation: isGallery,
    items: inlineBotResults,
    onSelect: onSelectResult,
    onClose,
  });

  useEffect(() => {
    setTooltipItemVisible('.chat-item-clickable', selectedIndex, containerRef);
  }, [selectedIndex]);

  const handleSendPm = useCallback(() => {
    openChat({ id: botId });
    startBot({ botId, param: switchPm!.startParam });
  }, [botId, openChat, startBot, switchPm]);

  const prevInlineBotResults = usePrevious(
    inlineBotResults?.length
      ? inlineBotResults
      : undefined,
    shouldRender,
  );
  const renderedInlineBotResults = inlineBotResults && !inlineBotResults.length
    ? prevInlineBotResults
    : inlineBotResults;

  if (!shouldRender || !(renderedInlineBotResults?.length || switchPm)) {
    return undefined;
  }

  const className = buildClassName(
    'InlineBotTooltip composer-tooltip',
    IS_TOUCH_ENV ? 'no-scrollbar' : 'custom-scroll',
    isGallery && 'gallery',
    transitionClassNames,
  );

  function renderSwitchPm() {
    return (
      <ListItem ripple className="switch-pm scroll-item" onClick={handleSendPm}>
        <span className="title">{switchPm!.text}</span>
      </ListItem>
    );
  }

  function renderContent() {
    return renderedInlineBotResults!.map((inlineBotResult, index) => {
      switch (inlineBotResult.type) {
        case 'gif':
          return (
            <GifResult
              key={inlineBotResult.id}
              inlineResult={inlineBotResult}
              observeIntersection={observeIntersection}
              onClick={onSelectResult}
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
    <InfiniteScroll
      ref={containerRef}
      className={className}
      items={renderedInlineBotResults}
      itemSelector=".chat-item-clickable"
      noFastList
      onLoadMore={handleLoadMore}
      sensitiveArea={160}
    >
      {switchPm && renderSwitchPm()}
      {renderedInlineBotResults?.length && renderContent()}
    </InfiniteScroll>
  );
};

export default memo(InlineBotTooltip);
