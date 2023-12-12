import React, {
  memo, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { addExtraClass, removeExtraClass } from '../../lib/teact/teact-dom';

import type { ApiStory } from '../../api/types';

import { requestMutation } from '../../lib/fasterdom/fasterdom';
import buildClassName from '../../util/buildClassName';
import { REM } from '../common/helpers/mediaDimensions';

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
const OVERFLOW_THRESHOLD_PX = 5.75 * REM;
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
    if (!ref.current) {
      return;
    }

    const { clientHeight } = ref.current;
    setHasOverflow(clientHeight > OVERFLOW_THRESHOLD_PX);
  }, [caption]);

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

  useEffect(() => {
    if (!showMoreButtonRef.current || !contentRef.current || !textRef.current) {
      return;
    }

    const container = contentRef.current;
    const textContainer = textRef.current;

    const textOffsetTop = textContainer.offsetTop;
    const lineHeight = parseInt(getComputedStyle(textContainer).lineHeight, 10);
    const overflowShift = textOffsetTop + lineHeight * LINES_TO_SHOW;

    const button = showMoreButtonRef.current;

    const { offsetWidth } = button;
    requestMutation(() => {
      container.style.setProperty('--_overflow-shift', `${overflowShift}px`);
      container.style.setProperty('--expand-button-width', `${offsetWidth}px`);
    });
  }, [canExpand]);

  useEffect(() => {
    if (!isExpanded) {
      ref.current?.scrollTo({ top: 0 });
    }
  }, [isExpanded]);

  const fullClassName = buildClassName(
    styles.captionContent,
    hasOverflow && !isExpanded && styles.hasOverflow,
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
