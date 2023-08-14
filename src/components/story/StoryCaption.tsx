import React, {
  memo, useEffect, useRef, useState,
} from '../../lib/teact/teact';

import type { ApiStory } from '../../api/types';

import buildClassName from '../../util/buildClassName';
import { requestMutation } from '../../lib/fasterdom/fasterdom';
import { addExtraClass, removeExtraClass } from '../../lib/teact/teact-dom';

import usePrevDuringAnimation from '../../hooks/usePrevDuringAnimation';
import useLang from '../../hooks/useLang';

import MessageText from '../common/MessageText';

import styles from './StoryViewer.module.scss';

interface OwnProps {
  story: ApiStory;
  isExpanded: boolean;
  onExpand: NoneToVoidFunction;
  className?: string;
}

const EXPAND_ANIMATION_DURATION_MS = 400;
const OVERFLOW_THRESHOLD_PX = 4;

function StoryCaption({
  story, isExpanded, className, onExpand,
}: OwnProps) {
  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const contentRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState<boolean>(false);
  const [height, setHeight] = useState<number>(0);
  const prevIsExpanded = usePrevDuringAnimation(isExpanded || undefined, EXPAND_ANIMATION_DURATION_MS);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    const { scrollHeight, clientHeight } = ref.current;
    setHasOverflow(scrollHeight - clientHeight > OVERFLOW_THRESHOLD_PX);
    setHeight(scrollHeight - clientHeight);
  }, []);

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
  }, [height, isExpanded]);

  const canExpand = hasOverflow && !isExpanded;
  const fullClassName = buildClassName(
    styles.captionContent,
    hasOverflow && !isExpanded && styles.hasOverflow,
    (isExpanded || prevIsExpanded) && styles.expanded,
    canExpand && styles.captionInteractive,
  );

  return (
    <div className={buildClassName(styles.caption, className)}>
      <div
        ref={contentRef}
        className={fullClassName}
        role={canExpand ? 'button' : undefined}
        style={`--scroll-height: ${isExpanded ? height : 0}px;`}
        onClick={canExpand ? () => onExpand() : undefined}
      >
        <div ref={ref} className={buildClassName(styles.captionInner, 'allow-selection', 'custom-scroll')}>
          {hasOverflow && (
            <div className={buildClassName(styles.captionExpand, isExpanded && styles.hidden)}>
              {lang('Story.CaptionShowMore')}
            </div>
          )}

          <MessageText
            messageOrStory={story}
            withTranslucentThumbs
          />
        </div>
      </div>
    </div>
  );
}

export default memo(StoryCaption);
