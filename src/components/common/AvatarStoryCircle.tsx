import {
  memo, useLayoutEffect, useMemo, useRef,
} from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ApiTypeStory } from '../../api/types';
import type { ThemeKey } from '../../types';

import { selectPeerStories, selectTheme } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { REM } from './helpers/mediaDimensions';

import useDevicePixelRatio from '../../hooks/window/useDevicePixelRatio';

interface OwnProps {
  peerId: string;
  className?: string;
  size: number;
  withExtraGap?: boolean;
  colors?: string[];
}

interface StateProps {
  peerStories?: Record<number, ApiTypeStory>;
  storyIds?: number[];
  lastReadId?: number;
  appTheme: ThemeKey;
}

const BLUE = ['#34C578', '#3CA3F3'];
const GREEN = ['#C9EB38', '#09C167'];
const GRAY = '#C4C9CC';
const DARK_GRAY = '#737373';
const STROKE_WIDTH = 0.125 * REM;
const STROKE_WIDTH_LARGE = 0.25 * REM;
const GAP_PERCENT = 2;
const SEGMENTS_MAX = 45; // More than this breaks rendering in Safari and Chrome
const LARGE_SIZE = 4 * REM;

const GAP_PERCENT_EXTRA = 10;
const EXTRA_GAP_ANGLE = Math.PI / 4;
const EXTRA_GAP_SIZE = (GAP_PERCENT_EXTRA / 100) * (2 * Math.PI);
const EXTRA_GAP_START = EXTRA_GAP_ANGLE - EXTRA_GAP_SIZE / 2;
const EXTRA_GAP_END = EXTRA_GAP_ANGLE + EXTRA_GAP_SIZE / 2;

function AvatarStoryCircle({
  size,
  className,
  peerStories,
  storyIds,
  lastReadId,
  withExtraGap,
  appTheme,
  colors,
}: OwnProps & StateProps) {
  const ref = useRef<HTMLCanvasElement>();

  const dpr = useDevicePixelRatio();

  const isLarge = size > LARGE_SIZE;
  const strokeWidth = isLarge ? STROKE_WIDTH_LARGE : STROKE_WIDTH;
  const adaptedSize = size + strokeWidth + (isLarge ? 0.25 * REM : 0); // Add extra gap space for large avatars

  const values = useMemo(() => {
    return (storyIds || []).reduce((acc, id) => {
      acc.total += 1;
      if (lastReadId && id <= lastReadId) {
        acc.read += 1;
      }

      return acc;
    }, { total: 0, read: 0 });
  }, [lastReadId, storyIds]);

  const isCloseFriend = useMemo(() => {
    if (!peerStories || !storyIds?.length) {
      return false;
    }

    return storyIds.some((id) => {
      const story = peerStories[id];
      if (!story || !('isForCloseFriends' in story)) {
        return false;
      }
      const isRead = lastReadId && story.id <= lastReadId;
      return story.isForCloseFriends && !isRead;
    });
  }, [lastReadId, peerStories, storyIds]);

  useLayoutEffect(() => {
    if (!ref.current) {
      return;
    }

    drawGradientCircle({
      canvas: ref.current,
      size: adaptedSize,
      strokeWidth,
      segmentsCount: values.total,
      colorStops: colors || (isCloseFriend ? GREEN : BLUE),
      readSegmentsCount: values.read,
      withExtraGap,
      readSegmentColor: appTheme === 'dark' ? DARK_GRAY : GRAY,
      dpr,
    });
  }, [appTheme, isCloseFriend, adaptedSize, values.read, values.total, withExtraGap, dpr, colors, size, strokeWidth]);

  if (!values.total) {
    return undefined;
  }

  return (
    <canvas
      ref={ref}
      className={buildClassName('story-circle', className)}
      style={`max-width: ${adaptedSize}px; max-height: ${adaptedSize}px;`}
    />
  );
}

export default memo(withGlobal<OwnProps>((global, { peerId }): Complete<StateProps> => {
  const peerStories = selectPeerStories(global, peerId);
  const appTheme = selectTheme(global);

  return {
    peerStories: peerStories?.byId,
    storyIds: peerStories?.orderedIds,
    lastReadId: peerStories?.lastReadId,
    appTheme,
  };
})(AvatarStoryCircle));

export function drawGradientCircle({
  canvas,
  size,
  strokeWidth: strokeWidthPx = STROKE_WIDTH,
  colorStops,
  segmentsCount,
  readSegmentsCount = 0,
  withExtraGap = false,
  readSegmentColor,
  dpr,
}: {
  canvas: HTMLCanvasElement;
  strokeWidth?: number;
  size: number;
  colorStops: string[];
  segmentsCount: number;
  readSegmentsCount?: number;
  withExtraGap?: boolean;
  readSegmentColor: string;
  dpr: number;
}) {
  if (segmentsCount > SEGMENTS_MAX) {
    readSegmentsCount = Math.round(readSegmentsCount * (SEGMENTS_MAX / segmentsCount));

    segmentsCount = SEGMENTS_MAX;
  }

  const sizeModifier = dpr;
  const strokeModifier = dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  const canvasSize = size * sizeModifier;
  const strokeWidth = strokeWidthPx * strokeModifier;

  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const centerCoordinate = canvasSize / 2;
  const radius = (canvasSize - strokeWidth) / 2;
  const segmentAngle = (2 * Math.PI) / segmentsCount;
  const gapSize = (GAP_PERCENT / 100) * (2 * Math.PI);
  const gradient = ctx.createLinearGradient(
    0,
    0,
    Math.ceil(canvasSize * Math.cos(Math.PI / 2)),
    Math.ceil(canvasSize * Math.sin(Math.PI / 2)),
  );

  if (colorStops.length === 1) {
    gradient.addColorStop(0, colorStops[0]);
    gradient.addColorStop(1, colorStops[0]);
  } else {
    colorStops.forEach((colorStop, index) => {
      gradient.addColorStop(index / (colorStops.length - 1), colorStop);
    });
  }

  ctx.lineCap = 'round';
  ctx.clearRect(0, 0, canvasSize, canvasSize);

  Array.from({ length: segmentsCount }).forEach((_, i) => {
    const isRead = i < readSegmentsCount;
    let startAngle = i * segmentAngle - Math.PI / 2 + gapSize / 2;
    let endAngle = startAngle + segmentAngle - (segmentsCount > 1 ? gapSize : 0);

    ctx.strokeStyle = isRead ? readSegmentColor : gradient;
    ctx.lineWidth = strokeWidth * (isRead ? 0.5 : 1);

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
