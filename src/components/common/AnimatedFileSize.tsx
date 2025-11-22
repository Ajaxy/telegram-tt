import { memo, useEffect, useRef, useState, useUnmountCleanup } from '@teact';

import { formatFileSize } from '../../util/textFormat';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

type OwnProps = {
  className?: string;
  size: number;
  progress?: number;
};

const SKIP_AFTER = 1024 * 1024 * 1024; // 1GB
const MIN_SIZE_INCREASE = 256 * 1024; // 256KB
const UPDATES_PER_SECOND = 10;

const AnimatedFileSize = ({
  className,
  size,
  progress,
}: OwnProps) => {
  const lang = useLang();
  const [currentSize, setCurrentSize] = useState<number>(0);
  const timerRef = useRef<number>();

  const resetAnimation = useLastCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = undefined;
  });

  const animateSize = useLastCallback(() => {
    if (progress === undefined) return;

    const currentTarget = size * progress;
    const diff = currentTarget - currentSize;

    if (diff !== 0) {
      const increase = Math.max(MIN_SIZE_INCREASE, diff / UPDATES_PER_SECOND);
      const newSize = Math.min(currentTarget, currentSize + increase);
      setCurrentSize(newSize);
    }

    timerRef.current = window.setTimeout(() => {
      animateSize();
    }, 1000 / UPDATES_PER_SECOND);
  });

  useEffect(() => {
    if (progress === undefined) {
      resetAnimation();
      setCurrentSize(0);
      return;
    };

    const currentProgress = size * progress;
    if (currentProgress > SKIP_AFTER || progress === 1) {
      resetAnimation();
      setCurrentSize(currentProgress);
      return;
    }

    if (timerRef.current) return;

    animateSize();
  }, [progress, size]);

  useUnmountCleanup(resetAnimation);

  const currentSizeString = formatFileSize(lang, currentSize, 2);
  const totalSizeString = formatFileSize(lang, size);

  if (progress === undefined || progress === 1) {
    return totalSizeString;
  }

  return (
    <span className={className} dir={lang.isRtl ? 'rtl' : undefined}>
      {lang('FileTransferProgress', {
        currentSize: currentSizeString,
        totalSize: totalSizeString,
      }, { withNodes: true })}
    </span>
  );
};

export default memo(AnimatedFileSize);
