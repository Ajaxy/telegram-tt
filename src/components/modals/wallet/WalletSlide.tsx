import type { TeactNode } from '../../../lib/teact/teact';
import { useEffect, useRef } from '../../../lib/teact/teact';

import { requestMeasure } from '../../../lib/fasterdom/fasterdom';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLastCallback from '../../../hooks/useLastCallback';

type OwnProps = {
  isRoot?: boolean;
  isActive?: boolean;
  className?: string;
  contentClassName?: string;
  children: TeactNode;
  onBack: NoneToVoidFunction;
  onScrolledChange?: (isScrolled: boolean) => void;
};

// The scrolling element paints the background, or the scrollbar gutter shows through as a bare strip.
// It also owns a history record, so the system back button steps through the screens first.
const WalletSlide = ({
  isRoot, isActive, className, contentClassName, children, onBack, onScrolledChange,
}: OwnProps) => {
  const ref = useRef<HTMLDivElement>();

  useHistoryBack({ isActive: !isRoot, onBack });

  // Only the shown slide reports, since a hidden one may still be scrolled by its list
  const reportScrolled = useLastCallback(() => {
    if (!isActive || !ref.current) return;

    onScrolledChange?.(ref.current.scrollTop > 0);
  });

  // A slide the user comes back to keeps its scroll without firing `scroll`, so it reports where it stands
  useEffect(() => {
    if (isActive) {
      requestMeasure(reportScrolled);
    }
  }, [isActive, reportScrolled]);

  return (
    <div ref={ref} className={className} onScroll={reportScrolled}>
      <div className={contentClassName}>{children}</div>
    </div>
  );
};

export default WalletSlide;
