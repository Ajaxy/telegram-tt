import {
  memo, useEffect, useLayoutEffect, useRef, useState,
} from '../../lib/teact/teact';
import { addExtraClass, removeExtraClass } from '../../lib/teact/teact-dom';

import type { ApiStory } from '../../api/types';

import { requestForcedReflow, requestMeasure, requestMutation } from '../../lib/fasterdom/fasterdom';
import buildClassName from '../../util/buildClassName';
import calcTextLineHeightAndCount from '../../util/element/calcTextLineHeightAndCount';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useOldLang from '../../hooks/useOldLang';
import usePrevDuringAnimation from '../../hooks/usePrevDuringAnimation';
import useShowTransitionDeprecated from '../../hooks/useShowTransitionDeprecated';

import EmbeddedStoryForward from '../common/embedded/EmbeddedStoryForward';
import MessageText from '../common/MessageText';

import styles from './StoryViewer.module.scss';

interface OwnProps {
  story: ApiStory;
  isExpanded: boolean;
  className?: string;
  onExpand: NoneToVoidFunction;
  onFold?: NoneToVoidFunction;
}

const EXPAND_ANIMATION_DURATION_MS = 400;
const LINES_TO_SHOW = 3;

function StoryCaption({
  story, isExpanded, className, onExpand, onFold,
}: OwnProps) {
  const lang = useOldLang();
  const ref = useRef<HTMLDivElement>();
  const contentRef = useRef<HTMLDivElement>();
  const textRef = useRef<HTMLDivElement>();
  const showMoreButtonRef = useRef<HTMLDivElement>();
  const renderingStory = useCurrentOrPrev(story, true);

  const caption = renderingStory?.content.text;

  const [hasOverflow, setHasOverflow] = useState(false);
  const prevIsExpanded = usePrevDuringAnimation(isExpanded || undefined, EXPAND_ANIMATION_DURATION_MS);
  const isInExpandedState = isExpanded || prevIsExpanded;

  useEffect(() => {
    requestMutation(() => {
      if (!contentRef.current) {
        return;
      }

      if (isExpanded) {
        addExtraClass(contentRef.current, styles.animate);
      } else {
        removeExtraClass(contentRef.current, styles.animate);
      }
    });
  }, [isExpanded]);

  const canExpand = hasOverflow && !isInExpandedState;
  const { shouldRender: shouldRenderShowMore, transitionClassNames } = useShowTransitionDeprecated(
    canExpand, undefined, true, 'slow', true,
  );

  // Setup gradient to clip caption before button
  useLayoutEffect(() => {
    requestMeasure(() => {
      const container = contentRef.current;
      const button = showMoreButtonRef.current;
      if (!container || !button) {
        return;
      }

      const { offsetWidth } = button;

      requestMutation(() => {
        container.style.setProperty('--expand-button-width', `${offsetWidth}px`);
      });
    });
  }, [shouldRenderShowMore, lang]);

  useLayoutEffect(() => {
    requestForcedReflow(() => {
      if (!contentRef.current || !textRef.current) {
        return undefined;
      }

      const container = contentRef.current;
      const textContainer = textRef.current;

      const textOffsetTop = textContainer.offsetTop;
      const { lineHeight, totalLines } = calcTextLineHeightAndCount(textContainer);
      const isOverflowing = totalLines > LINES_TO_SHOW;
      const overflowShift = textOffsetTop + lineHeight * LINES_TO_SHOW;

      return () => {
        if (isOverflowing) {
          addExtraClass(container, styles.hasOverflow);
          setHasOverflow(true);
        }

        container.style.setProperty('--_overflow-shift', `${overflowShift}px`);
      };
    });
  }, [caption]);

  useEffect(() => {
    if (!isExpanded) {
      ref.current?.scrollTo({ top: 0 });
    }
  }, [isExpanded]);

  const fullClassName = buildClassName(
    styles.captionContent,
    isInExpandedState && styles.expanded,
    shouldRenderShowMore && styles.withShowMore,
  );

  return (
    <div className={buildClassName(styles.caption, className)}>
      <div
        ref={contentRef}
        className={fullClassName}
        role={canExpand ? 'button' : undefined}
        onClick={canExpand ? onExpand : onFold}
      >
        <div
          ref={ref}
          className={buildClassName(styles.captionInner, 'allow-selection', 'custom-scroll')}
        >
          {renderingStory?.forwardInfo && (
            <EmbeddedStoryForward
              forwardInfo={renderingStory.forwardInfo}
              className={styles.forwardInfo}
            />
          )}
          {renderingStory && (
            <div ref={textRef} className={styles.captionText}>
              <MessageText
                messageOrStory={renderingStory}
                withTranslucentThumbs
                forcePlayback
              />
            </div>
          )}
        </div>
      </div>
      {shouldRenderShowMore && (
        <div
          ref={showMoreButtonRef}
          className={buildClassName(styles.captionShowMore, transitionClassNames)}
          onClick={onExpand}
        >
          {lang('Story.CaptionShowMore')}
        </div>
      )}
    </div>
  );
}

export default memo(StoryCaption);
