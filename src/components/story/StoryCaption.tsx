import React, {
  memo, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { requestMutation } from '../../lib/fasterdom/fasterdom';
import { addExtraClass, removeExtraClass } from '../../lib/teact/teact-dom';

import type { ApiStory } from '../../api/types';

import buildClassName from '../../util/buildClassName';
import { REM } from '../common/helpers/mediaDimensions';

import usePrevDuringAnimation from '../../hooks/usePrevDuringAnimation';
import useLang from '../../hooks/useLang';
import useShowTransition from '../../hooks/useShowTransition';

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

function StoryCaption({
  story, isExpanded, className, onExpand, onFold,
}: OwnProps) {
  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const contentRef = useRef<HTMLDivElement>(null);
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
    if (!showMoreButtonRef.current || !contentRef.current) {
      return;
    }

    const button = showMoreButtonRef.current;
    const container = contentRef.current;

    const { offsetWidth } = button;
    requestMutation(() => {
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
          <MessageText
            messageOrStory={story}
            withTranslucentThumbs
            forcePlayback
          />
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
