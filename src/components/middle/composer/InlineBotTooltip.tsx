import type { FC } from '../../../lib/teact/teact';
import { memo, useEffect, useRef } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type {
  ApiBotInlineMediaResult, ApiBotInlineResult, ApiBotInlineSwitchPm, ApiBotInlineSwitchWebview,
} from '../../../api/types';
import { LoadMoreDirection } from '../../../types';

import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import { throttle } from '../../../util/schedulers';
import setTooltipItemVisible from '../../../util/setTooltipItemVisible';
import { extractCurrentThemeParams } from '../../../util/themeStyle';

import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import usePreviousDeprecated from '../../../hooks/usePreviousDeprecated';
import useShowTransitionDeprecated from '../../../hooks/useShowTransitionDeprecated';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';

import InfiniteScroll from '../../ui/InfiniteScroll';
import ListItem from '../../ui/ListItem';
import ArticleResult from './inlineResults/ArticleResult';
import GifResult from './inlineResults/GifResult';
import MediaResult from './inlineResults/MediaResult';
import StickerResult from './inlineResults/StickerResult';

import './InlineBotTooltip.scss';

const INTERSECTION_DEBOUNCE_MS = 200;
const runThrottled = throttle((cb) => cb(), 500, true);

export type OwnProps = {
  isOpen: boolean;
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
  onClose: NoneToVoidFunction;
  isCurrentUserPremium?: boolean;
};

const InlineBotTooltip: FC<OwnProps> = ({
  isOpen,
  botId,
  isGallery,
  inlineBotResults,
  switchPm,
  switchWebview,
  isSavedMessages,
  canSendGifs,
  loadMore,
  onClose,
  onSelectResult,
  isCurrentUserPremium,
}) => {
  const {
    openChat,
    startBot,
    requestSimpleWebView,
  } = getActions();

  const containerRef = useRef<HTMLDivElement>();
  const { shouldRender, transitionClassNames } = useShowTransitionDeprecated(isOpen, undefined, undefined, false);
  const renderedIsGallery = useCurrentOrPrev(isGallery, shouldRender);
  const {
    observe: observeIntersection,
  } = useIntersectionObserver({
    rootRef: containerRef,
    debounceMs: INTERSECTION_DEBOUNCE_MS,
    isDisabled: !isOpen,
  });

  const handleLoadMore = useLastCallback(({ direction }: { direction: LoadMoreDirection }) => {
    if (direction === LoadMoreDirection.Backwards) {
      runThrottled(loadMore);
    }
  });

  const selectedIndex = useKeyboardNavigation({
    isActive: isOpen,
    shouldRemoveSelectionOnReset: renderedIsGallery,
    noArrowNavigation: renderedIsGallery,
    items: inlineBotResults,
    onSelect: onSelectResult,
    onClose,
  });

  useEffect(() => {
    setTooltipItemVisible('.chat-item-clickable', selectedIndex, containerRef);
  }, [selectedIndex]);

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

  const prevInlineBotResults = usePreviousDeprecated(
    inlineBotResults?.length
      ? inlineBotResults
      : undefined,
    shouldRender,
  );
  const renderedInlineBotResults = inlineBotResults?.length ? inlineBotResults : prevInlineBotResults;

  if (!shouldRender || !(renderedInlineBotResults?.length || switchPm || switchWebview)) {
    return undefined;
  }

  const className = buildClassName(
    'InlineBotTooltip composer-tooltip',
    IS_TOUCH_ENV ? 'no-scrollbar' : 'custom-scroll',
    renderedIsGallery && 'gallery',
    transitionClassNames,
  );

  function renderSwitchPm() {
    return (
      <ListItem ripple className="switch-pm scroll-item" onClick={handleSendPm}>
        <span className="title">{switchPm!.text}</span>
      </ListItem>
    );
  }

  function renderSwitchWebview() {
    return (
      <ListItem ripple className="switch-pm scroll-item" onClick={handleOpenWebview}>
        <span className="title">{switchWebview!.text}</span>
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
              isSavedMessages={isSavedMessages}
              canSendGifs={canSendGifs}
            />
          );

        case 'photo':
          return (
            <MediaResult
              key={inlineBotResult.id}
              isForGallery={renderedIsGallery}
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
      {switchWebview && renderSwitchWebview()}
      {Boolean(renderedInlineBotResults?.length) && renderContent()}
    </InfiniteScroll>
  );
};

export default memo(InlineBotTooltip);
