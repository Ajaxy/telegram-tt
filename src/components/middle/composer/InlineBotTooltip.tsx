import React, {
  FC, memo, useCallback, useEffect, useRef, useState,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import { ApiBotInlineMediaResult, ApiBotInlineResult, ApiBotInlineSwitchPm } from '../../../api/types';
import { IAllowedAttachmentOptions } from '../../../modules/helpers';
import { LoadMoreDirection } from '../../../types';

import { IS_TOUCH_ENV } from '../../../util/environment';
import setTooltipItemVisible from '../../../util/setTooltipItemVisible';
import buildClassName from '../../../util/buildClassName';
import captureKeyboardListeners from '../../../util/captureKeyboardListeners';
import cycleRestrict from '../../../util/cycleRestrict';
import useShowTransition from '../../../hooks/useShowTransition';
import { throttle } from '../../../util/schedulers';
import { pick } from '../../../util/iteratees';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import usePrevious from '../../../hooks/usePrevious';

import MediaResult from './inlineResults/MediaResult';
import ArticleResult from './inlineResults/ArticleResult';
import GifResult from './inlineResults/GifResult';
import StickerResult from './inlineResults/StickerResult';
import ListItem from '../../ui/ListItem';
import InfiniteScroll from '../../ui/InfiniteScroll';

import './InlineBotTooltip.scss';

const INTERSECTION_DEBOUNCE_MS = 200;
const runThrottled = throttle((cb) => cb(), 500, true);

export type OwnProps = {
  isOpen: boolean;
  botId?: number;
  isGallery?: boolean;
  allowedAttachmentOptions: IAllowedAttachmentOptions;
  inlineBotResults?: (ApiBotInlineResult | ApiBotInlineMediaResult)[];
  switchPm?: ApiBotInlineSwitchPm;
  onSelectResult: (inlineResult: ApiBotInlineMediaResult | ApiBotInlineResult) => void;
  loadMore: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
};

type DispatchProps = Pick<GlobalActions, ('sendBotCommand' | 'openChat' | 'sendInlineBotResult')>;

const InlineBotTooltip: FC<OwnProps & DispatchProps> = ({
  isOpen,
  botId,
  isGallery,
  inlineBotResults,
  switchPm,
  loadMore,
  onClose,
  openChat,
  sendBotCommand,
  onSelectResult,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldRender, transitionClassNames } = useShowTransition(isOpen, undefined, undefined, false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const {
    observe: observeIntersection,
  } = useIntersectionObserver({
    rootRef: containerRef,
    debounceMs: INTERSECTION_DEBOUNCE_MS,
    isDisabled: !isOpen,
  });

  useEffect(() => {
    setSelectedIndex(isGallery ? -1 : 0);
  }, [inlineBotResults, isGallery]);

  useEffect(() => {
    setTooltipItemVisible('.chat-item-clickable', selectedIndex, containerRef);
  }, [selectedIndex]);

  const getSelectedIndex = useCallback((newIndex: number) => {
    if (!inlineBotResults || !inlineBotResults.length) {
      return -1;
    }

    return cycleRestrict(inlineBotResults.length, newIndex);
  }, [inlineBotResults]);

  const handleArrowKey = useCallback((value: number, e: KeyboardEvent) => {
    if (isGallery) {
      return;
    }

    e.preventDefault();
    setSelectedIndex((index) => (getSelectedIndex(index + value)));
  }, [isGallery, getSelectedIndex]);

  const handleSelectInlineBotResult = useCallback((e: KeyboardEvent) => {
    if (inlineBotResults && inlineBotResults.length && selectedIndex > -1) {
      const inlineResult = inlineBotResults[selectedIndex];
      if (inlineResult) {
        e.preventDefault();
        onSelectResult(inlineResult);
      }
    }
  }, [inlineBotResults, onSelectResult, selectedIndex]);

  const handleLoadMore = useCallback(({ direction }: { direction: LoadMoreDirection }) => {
    if (direction === LoadMoreDirection.Backwards) {
      runThrottled(loadMore);
    }
  }, [loadMore]);

  useEffect(() => (isOpen ? captureKeyboardListeners({
    onEsc: onClose,
    onUp: (e: KeyboardEvent) => handleArrowKey(-1, e),
    onDown: (e: KeyboardEvent) => handleArrowKey(1, e),
    onEnter: handleSelectInlineBotResult,
  }) : undefined), [handleArrowKey, handleSelectInlineBotResult, isGallery, isOpen, onClose]);

  const handleSendPm = useCallback(() => {
    openChat({ id: botId });
    sendBotCommand({ chatId: botId, command: `/start ${switchPm!.startParam}` });
  }, [botId, openChat, sendBotCommand, switchPm]);

  const prevInlineBotResults = usePrevious(
    inlineBotResults && inlineBotResults.length
      ? inlineBotResults
      : undefined,
    shouldRender,
  );
  const renderedInlineBotResults = inlineBotResults && !inlineBotResults.length
    ? prevInlineBotResults
    : inlineBotResults;

  if (!shouldRender || !renderedInlineBotResults || (!renderedInlineBotResults.length && !switchPm)) {
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
      {renderContent()}
    </InfiniteScroll>
  );
};

export default memo(withGlobal<OwnProps>(
  undefined,
  (setGlobal, actions): DispatchProps => pick(actions, [
    'sendBotCommand', 'openChat', 'sendInlineBotResult',
  ]),
)(InlineBotTooltip));
