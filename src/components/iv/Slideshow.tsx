import type { TeactNode } from '../../lib/teact/teact';
import { useMemo, useRef, useState } from '../../lib/teact/teact';

import type {
  ApiPageBlockPhoto,
  ApiPageBlockVideo,
  ApiPageCaption,
} from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { ThemeKey } from '../../types';

import { requestMeasure } from '../../lib/fasterdom/fasterdom';
import { getMediaDimensions } from '../../global/helpers';
import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';
import { getPageMediaBlockId, getPageMediaBlockMedia } from './helpers/pageMedia';

import useHorizontalScroll from '../../hooks/useHorizontalScroll';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useScrollableHint from '../../hooks/useScrollableHint';
import useScrollToActiveTab from '../../hooks/useScrollToActiveTab';

import Photo from '../middle/message/Photo';
import Video from '../middle/message/Video';

import styles from './Slideshow.module.scss';

type SlideshowItem = ApiPageBlockPhoto | ApiPageBlockVideo;

type OwnProps = {
  items: SlideshowItem[];
  canAutoLoadMedia?: boolean;
  isProtected?: boolean;
  noSpoilerReveal?: boolean;
  theme: ThemeKey;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  sourceIds: string[];
  className?: string;
  getUploadProgress?: (item: SlideshowItem, index: number) => number | undefined;
  renderCaption: (caption: ApiPageCaption) => TeactNode;
  renderOverlay?: (item: SlideshowItem, index: number) => TeactNode;
  onCancelUpload?: (index: number) => void;
  onMediaClick: (index: number) => void;
};

const Slideshow = ({
  items,
  canAutoLoadMedia,
  isProtected,
  noSpoilerReveal,
  theme,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  sourceIds,
  className,
  getUploadProgress,
  renderCaption,
  renderOverlay,
  onCancelUpload,
  onMediaClick,
}: OwnProps) => {
  const scrollerRef = useRef<HTMLDivElement>();
  const dotsRef = useRef<HTMLDivElement>();
  const [activeIndex, setActiveIndex] = useState(0);

  const lang = useLang();
  const hasMultipleSlides = items.length > 1;
  const clampedIndex = Math.max(0, Math.min(activeIndex, items.length - 1));
  const aspectRatio = useMemo(() => {
    const ratios = items.map((item) => {
      const dimensions = getMediaDimensions(getPageMediaBlockMedia(item));
      return dimensions.isFallback ? undefined : dimensions.width / dimensions.height;
    }).filter((ratio): ratio is number => ratio !== undefined);

    return ratios.length
      ? ratios.reduce((total, ratio) => total + ratio, 0) / ratios.length
      : 16 / 9;
  }, [items]);

  useScrollableHint(scrollerRef, { isDisabled: !hasMultipleSlides });
  useHorizontalScroll(dotsRef, !hasMultipleSlides, true, true);
  useScrollToActiveTab(dotsRef, clampedIndex);

  const scrollToSlide = useLastCallback((index: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const left = index * scroller.clientWidth;
    requestMeasure(() => {
      scroller.scrollTo({ left, behavior: 'smooth' });
    });
  });

  const handleScroll = useLastCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scroller = e.currentTarget;
    if (!scroller.clientWidth) return;

    const nextIndex = Math.min(
      Math.max(Math.round(scroller.scrollLeft / scroller.clientWidth), 0),
      items.length - 1,
    );
    if (nextIndex === clampedIndex) return;

    setActiveIndex(nextIndex);
  });

  const handlePreviousClick = useLastCallback(() => {
    scrollToSlide(Math.max(clampedIndex - 1, 0));
  });

  const handleNextClick = useLastCallback(() => {
    scrollToSlide(Math.min(clampedIndex + 1, items.length - 1));
  });

  const handleControlMouseDown = useLastCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
  });

  if (!items.length) {
    return undefined;
  }
  const activeItem = items[clampedIndex];

  return (
    <>
      <div
        className={buildClassName(styles.root, className)}
        style={buildStyle(`--slideshow-aspect-ratio: ${aspectRatio}`)}
      >
        <div
          ref={scrollerRef}
          className={buildClassName(styles.scroller, 'no-scrollbar')}
          dir="ltr"
          onScroll={hasMultipleSlides ? handleScroll : undefined}
        >
          {items.map((item, index) => (
            <div key={`${getSlideshowItemId(item)}-${index}`} className={styles.slide}>
              {renderSlideshowItem(item, {
                index,
                // Only the active slide is a target for the Media Viewer ghost animation
                sourceId: index === clampedIndex ? sourceIds[index] : undefined,
                canAutoLoadMedia,
                isProtected,
                noSpoilerReveal,
                theme,
                observeIntersectionForLoading,
                observeIntersectionForPlaying,
                getUploadProgress,
                renderOverlay,
                onCancelUpload,
                onMediaClick,
              })}
            </div>
          ))}
        </div>
        {hasMultipleSlides && (
          <>
            {clampedIndex > 0 && (
              <button
                type="button"
                className={buildClassName(styles.navButton, styles.previousButton)}
                aria-label={lang('AccDescrPrevious')}
                onMouseDown={handleControlMouseDown}
                onClick={handlePreviousClick}
              />
            )}
            {clampedIndex < items.length - 1 && (
              <button
                type="button"
                className={buildClassName(styles.navButton, styles.nextButton)}
                aria-label={lang('Next')}
                onMouseDown={handleControlMouseDown}
                onClick={handleNextClick}
              />
            )}
            <div ref={dotsRef} className={buildClassName(styles.dots, 'no-scrollbar')} dir="ltr">
              {items.map((item, index) => (
                <button
                  key={`${getSlideshowItemId(item)}-${index}`}
                  type="button"
                  className={buildClassName(styles.dot, index === clampedIndex && styles.activeDot)}
                  aria-label={lang.number(index + 1)}
                  aria-current={index === clampedIndex ? 'true' : undefined}
                  onMouseDown={handleControlMouseDown}
                  onClick={() => scrollToSlide(index)}
                />
              ))}
            </div>
          </>
        )}
      </div>
      {renderCaption(activeItem.caption)}
    </>
  );
};

type RenderItemContext = Pick<OwnProps,
  'canAutoLoadMedia'
  | 'isProtected'
  | 'noSpoilerReveal'
  | 'theme'
  | 'observeIntersectionForLoading'
  | 'observeIntersectionForPlaying'
>;

type SlideshowItemContext = RenderItemContext & {
  index: number;
  sourceId?: string;
  getUploadProgress?: OwnProps['getUploadProgress'];
  renderOverlay?: OwnProps['renderOverlay'];
  onCancelUpload?: OwnProps['onCancelUpload'];
  onMediaClick: (index: number) => void;
};

function renderSlideshowItem(item: SlideshowItem, context: SlideshowItemContext) {
  switch (item.type) {
    case 'photo':
      return (
        <>
          <Photo
            id={context.sourceId}
            photo={getPageMediaBlockMedia(item)}
            canAutoLoad={context.canAutoLoadMedia}
            isProtected={context.isProtected}
            noSpoilerReveal={context.noSpoilerReveal}
            theme={context.theme}
            observeIntersection={context.observeIntersectionForLoading}
            uploadProgress={context.getUploadProgress?.(item, context.index)}
            layout="fill"
            className={styles.media}
            clickArg={context.index}
            onClick={context.onMediaClick}
            onCancelUpload={context.onCancelUpload}
          />
          {context.renderOverlay?.(item, context.index)}
        </>
      );
    case 'video':
      return (
        <>
          <Video
            id={context.sourceId}
            video={getPageMediaBlockMedia(item)}
            canAutoLoad={context.canAutoLoadMedia}
            canAutoPlay={item.isAutoplay && context.canAutoLoadMedia}
            isProtected={context.isProtected}
            noSpoilerReveal={context.noSpoilerReveal}
            observeIntersectionForLoading={context.observeIntersectionForLoading}
            observeIntersectionForPlaying={context.observeIntersectionForPlaying}
            uploadProgress={context.getUploadProgress?.(item, context.index)}
            layout="fill"
            className={styles.media}
            clickArg={context.index}
            onClick={context.onMediaClick}
            onCancelUpload={context.onCancelUpload}
          />
          {context.renderOverlay?.(item, context.index)}
        </>
      );
  }
}

function getSlideshowItemId(item: SlideshowItem) {
  return getPageMediaBlockId(item);
}

export default Slideshow;
