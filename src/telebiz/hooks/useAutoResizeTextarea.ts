import type { CSSProperties } from 'react';
import { useMemo } from '../../lib/teact/teact';

const MIN_HEIGHT = 24; // 1 line
const LINE_HEIGHT = 20; // Approximate line height
const MAX_HEIGHT = 192; // ~8 lines

export default function useAutoResizeTextarea(
  _ref: React.RefObject<HTMLTextAreaElement>,
  value: string,
  minHeight = MIN_HEIGHT,
  maxHeight = MAX_HEIGHT,
): CSSProperties {
  // Estimate height based on content (newlines + wrapping estimate)
  const style = useMemo(() => {
    const lineCount = (value.match(/\n/g) || []).length + 1;
    // Rough estimate: assume ~50 chars per line for wrapping
    const estimatedWraps = Math.ceil(value.length / 50);
    const totalLines = Math.max(lineCount, estimatedWraps);

    const estimatedHeight = Math.max(minHeight, totalLines * LINE_HEIGHT);
    const height = Math.min(estimatedHeight, maxHeight);
    const overflowY = estimatedHeight > maxHeight ? 'auto' : 'hidden';

    return {
      height: `${height}px`,
      overflowY,
    } as CSSProperties;
  }, [value, minHeight, maxHeight]);

  return style;
}
