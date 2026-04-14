import { memo, useEffect, useRef, useState } from '../../lib/teact/teact';

import { requestMeasure } from '../../lib/fasterdom/fasterdom';
import buildClassName from '../../util/buildClassName';
import { REM } from '../common/helpers/mediaDimensions';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useResizeObserver from '../../hooks/useResizeObserver';

import styles from './ExpandableText.module.scss';

const DEFAULT_COLLAPSED_HEIGHT = 4.1875 * REM;

type OwnProps = {
  text?: string;
  collapsedHeight?: number;
  className?: string;
};

const ExpandableText = ({ text, collapsedHeight = DEFAULT_COLLAPSED_HEIGHT, className }: OwnProps) => {
  const lang = useLang();

  const [isExpanded, expand, collapse] = useFlag(false);
  const [expandedHeight, setExpandedHeight] = useState<number | undefined>();
  const [shouldTruncate, setShouldTruncate] = useState(false);

  const contentRef = useRef<HTMLSpanElement>();

  const displayText = text || '';
  const canExpand = shouldTruncate;

  const measureTruncation = useLastCallback(() => {
    requestMeasure(() => {
      if (!contentRef.current) return;
      setShouldTruncate(contentRef.current.scrollHeight > collapsedHeight);
    });
  });

  useEffect(() => {
    measureTruncation();
  }, [displayText, collapsedHeight, measureTruncation]);

  useResizeObserver(contentRef, measureTruncation);

  const handleToggleExpand = useLastCallback(() => {
    if (isExpanded) {
      collapse();
    } else {
      if (contentRef.current) {
        setExpandedHeight(contentRef.current.scrollHeight);
      }
      expand();
    }
  });

  return (
    <div className={buildClassName(styles.root, !isExpanded && canExpand && styles.truncated, className)}>
      <div
        className={styles.inner}
        style={isExpanded && expandedHeight
          ? `height: ${expandedHeight}px`
          : `height: ${collapsedHeight / REM}rem`}
      >
        <span ref={contentRef} className={styles.content}>{displayText}</span>
      </div>
      {canExpand && (
        <span className={styles.moreLinkWrapper}>
          <span className={styles.moreLink} onClick={handleToggleExpand}>
            {lang(isExpanded ? 'TextShowLess' : 'TextShowMore')}
          </span>
        </span>
      )}
    </div>
  );
};

export default memo(ExpandableText);
