import type { ElementRef, TeactNode } from '../../../lib/teact/teact';

import useHistoryBack from '../../../hooks/useHistoryBack';

type OwnProps = {
  isRoot?: boolean;
  ref?: ElementRef<HTMLDivElement>;
  className?: string;
  contentClassName?: string;
  children: TeactNode;
  onBack: NoneToVoidFunction;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
};

// The scrolling element paints the background, or the scrollbar gutter shows through as a bare strip.
// It also owns a history record, so the system back button steps through the screens first.
const WalletSlide = ({
  isRoot, ref, className, contentClassName, children, onBack, onScroll,
}: OwnProps) => {
  useHistoryBack({ isActive: !isRoot, onBack });

  return (
    <div ref={ref} className={className} onScroll={onScroll}>
      <div className={contentClassName}>{children}</div>
    </div>
  );
};

export default WalletSlide;
