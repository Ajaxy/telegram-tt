import React, {
  memo, useLayoutEffect, useMemo, useRef,
} from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ThemeKey } from '../../types';
import type { AvatarSize } from './Avatar';

import { selectPeerStories, selectTheme, selectUser } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { DPR } from '../../util/windowEnvironment';
import { REM } from './helpers/mediaDimensions';

interface OwnProps {
  // eslint-disable-next-line react/no-unused-prop-types
  peerId: string;
  className?: string;
  size: AvatarSize;
  withExtraGap?: boolean;
}

interface StateProps {
  isCloseFriend?: boolean;
  storyIds?: number[];
  lastReadId?: number;
  appTheme: ThemeKey;
}

const SIZES: Record<AvatarSize, number> = {
  micro: 1.125 * DPR * REM,
  tiny: 2.125 * DPR * REM,
  mini: 1.625 * DPR * REM,
  small: 2.25 * DPR * REM,
  'small-mobile': 2.625 * DPR * REM,
  medium: 2.875 * DPR * REM,
  large: 3.5 * DPR * REM,
  giant: 5.125 * DPR * REM,
  jumbo: 7.625 * DPR * REM,
};

const BLUE = ['#34C578', '#3CA3F3'];
const GREEN = ['#C9EB38', '#09C167'];
const PURPLE = ['#A667FF', '#55A5FF'];
const GRAY = '#C4C9CC';
const DARK_GRAY = '#737373';
const STROKE_WIDTH = 0.125 * DPR * REM;
const STROKE_WIDTH_READ = 0.0625 * DPR * REM;
const GAP_PERCENT = 2;
const SEGMENTS_MAX = 45; // More than this breaks rendering in Safari and Chrome

const GAP_PERCENT_EXTRA = 10;
const EXTRA_GAP_ANGLE = Math.PI / 4;
const EXTRA_GAP_SIZE = (GAP_PERCENT_EXTRA / 100) * (2 * Math.PI);
const EXTRA_GAP_START = EXTRA_GAP_ANGLE - EXTRA_GAP_SIZE / 2;
const EXTRA_GAP_END = EXTRA_GAP_ANGLE + EXTRA_GAP_SIZE / 2;

function AvatarStoryCircle({
  size = 'large',
  className,
  isCloseFriend,
  storyIds,
  lastReadId,
  withExtraGap,
  appTheme,
}: OwnProps & StateProps) {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLCanvasElement>(null);

  const values = useMemo(() => {
    return (storyIds || []).reduce((acc, id) => {
      acc.total += 1;
      if (lastReadId && id <= lastReadId) {
        acc.read += 1;
      }

      return acc;
    }, { total: 0, read: 0 });
  }, [lastReadId, storyIds]);

  useLayoutEffect(() => {
    if (!ref.current) {
      return;
    }

    drawGradientCircle({
      canvas: ref.current,
      size: SIZES[size],
      segmentsCount: values.total,
      color: isCloseFriend ? 'green' : 'blue',
      readSegmentsCount: values.read,
      withExtraGap,
      readSegmentColor: appTheme === 'dark' ? DARK_GRAY : GRAY,
    });
  }, [appTheme, isCloseFriend, size, values.read, values.total, withExtraGap]);

  if (!values.total) {
    return undefined;
  }

  const maxSize = SIZES[size] / DPR;

  return (
    <canvas
      ref={ref}
      className={buildClassName('story-circle', size, className)}
      style={`max-width: ${maxSize}px; max-height: ${maxSize}px;`}
    />
  );
}

export default memo(withGlobal<OwnProps>((global, { peerId }): StateProps => {
  const user = selectUser(global, peerId);
  const peerStories = selectPeerStories(global, peerId);
  const appTheme = selectTheme(global);

  return {
    isCloseFriend: user?.isCloseFriend,
    storyIds: peerStories?.orderedIds,
    lastReadId: peerStories?.lastReadId,
    appTheme,
  };
})(AvatarStoryCircle));

export function drawGradientCircle({
  canvas,
  size,
  color,
  segmentsCount,
  readSegmentsCount = 0,
  withExtraGap = false,
  readSegmentColor,
}: {
  canvas: HTMLCanvasElement;
  size: number;
  color: string;
  segmentsCount: number;
  readSegmentsCount?: number;
  withExtraGap?: boolean;
  readSegmentColor: string;
}) {
  if (segmentsCount > SEGMENTS_MAX) {
    readSegmentsCount = Math.round(readSegmentsCount * (SEGMENTS_MAX / segmentsCount));

    segmentsCount = SEGMENTS_MAX;
  }

  const strokeModifier = Math.max(Math.max(size - SIZES.large, 0) / DPR / REM / 1.5, 1);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  canvas.width = size;
  canvas.height = size;
  const centerCoordinate = size / 2;
  const radius = (size - STROKE_WIDTH * strokeModifier) / 2;
  const segmentAngle = (2 * Math.PI) / segmentsCount;
  const gapSize = (GAP_PERCENT / 100) * (2 * Math.PI);
  const gradient = ctx.createLinearGradient(
    0,
    0,
    Math.ceil(size * Math.cos(Math.PI / 2)),
    Math.ceil(size * Math.sin(Math.PI / 2)),
  );

  const colorStops = color === 'purple' ? PURPLE : color === 'green' ? GREEN : BLUE;
  colorStops.forEach((colorStop, index) => {
    gradient.addColorStop(index / (colorStops.length - 1), colorStop);
  });

  ctx.lineCap = 'round';
  ctx.clearRect(0, 0, size, size);

  Array.from({ length: segmentsCount }).forEach((_, i) => {
    const isRead = i < readSegmentsCount;
    let startAngle = i * segmentAngle - Math.PI / 2 + gapSize / 2;
    let endAngle = startAngle + segmentAngle - (segmentsCount > 1 ? gapSize : 0);

    ctx.strokeStyle = isRead ? readSegmentColor : gradient;
    ctx.lineWidth = (isRead ? STROKE_WIDTH_READ : STROKE_WIDTH) * strokeModifier;

    if (withExtraGap) {
      if (startAngle >= EXTRA_GAP_START && endAngle <= EXTRA_GAP_END) { // Segment is inside extra gap
        return;
      } else if (startAngle < EXTRA_GAP_START && endAngle > EXTRA_GAP_END) { // Extra gap is inside segment
        ctx.beginPath();
        ctx.arc(centerCoordinate, centerCoordinate, radius, EXTRA_GAP_END, endAngle);
        ctx.stroke();

        endAngle = EXTRA_GAP_START;
      } else if (startAngle < EXTRA_GAP_START && endAngle > EXTRA_GAP_START) { // Segment ends in extra gap
        endAngle = EXTRA_GAP_START;
      } else if (startAngle < EXTRA_GAP_END && endAngle > EXTRA_GAP_END) { // Segment starts in extra gap
        startAngle = EXTRA_GAP_END;
      }
    }

    ctx.beginPath();
    ctx.arc(centerCoordinate, centerCoordinate, radius, startAngle, endAngle);
    ctx.stroke();
  });
}
