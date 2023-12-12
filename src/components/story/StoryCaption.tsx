import React, {
  memo, useEffect, useLayoutEffect, useRef, useState,
} from '../../lib/teact/teact';
import { addExtraClass, removeExtraClass } from '../../lib/teact/teact-dom';

import type { ApiStory } from '../../api/types';

import { requestForcedReflow, requestMeasure, requestMutation } from '../../lib/fasterdom/fasterdom';
import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';
import usePrevDuringAnimation from '../../hooks/usePrevDuringAnimation';
import useShowTransition from '../../hooks/useShowTransition';

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
  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const contentRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const textRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const showMoreButtonRef = useRef<HTMLDivElement>(null);

  const caption = story.content.text;

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
  const { shouldRender: shouldRenderShowMore, transitionClassNames } = useShowTransition(
    canExpand, undefined, true, 'slow', true,
  );

  useLayoutEffect(() => {
    requestMeasure(() => {
      if (!showMoreButtonRef.current) {
        return;
      }

      const button = showMoreButtonRef.current;

      const { offsetWidth } = button;

      requestMutation(() => {
        button.style.setProperty('--expand-button-width', `${offsetWidth}px`);
      });
    });
  }, []);

  useLayoutEffect(() => {
    requestForcedReflow(() => {
      if (!contentRef.current || !textRef.current) {
        return undefined;
      }

      const container = contentRef.current;
      const textContainer = textRef.current;

      const textOffsetTop = textContainer.offsetTop;
      const lineHeight = parseInt(getComputedStyle(textContainer).lineHeight, 10);
      const isOverflowing = textContainer.clientHeight > lineHeight * LINES_TO_SHOW;
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
          {story.forwardInfo && (
            <EmbeddedStoryForward
              forwardInfo={story.forwardInfo}
              className={styles.forwardInfo}
            />
          )}
          <div ref={textRef} className={styles.captionText}>
            <MessageText
              messageOrStory={story}
              withTranslucentThumbs
              forcePlayback
            />
          </div>
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
