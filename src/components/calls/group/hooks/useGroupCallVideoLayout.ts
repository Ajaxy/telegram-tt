import type { RefObject } from 'react';
import {
  useEffect, useMemo, useState,
} from '../../../../lib/teact/teact';

import useLastCallback from '../../../../hooks/useLastCallback';
import usePreviousDeprecated from '../../../../hooks/usePreviousDeprecated';
import useResizeObserver from '../../../../hooks/useResizeObserver';

const PADDING_HORIZONTAL = 10;
const PADDING_VERTICAL = 8;
const PREFERRED_PANEL_VIDEO_HEIGHT = 240;

export type VideoLayout = {
  participantId: string;
  type: 'video' | 'screen';
  x: number;
  y: number;
  width: number;
  height: number;
  shouldRemount?: boolean;
  isRemounted?: boolean;
  noAnimate?: boolean;
  isRemoved?: boolean;
  orderKey: number;
};

export type VideoParticipant = {
  id: string;
  type: 'video' | 'screen';
};

export default function useGroupCallVideoLayout({
  primaryContainerRef,
  secondaryContainerRef,
  videoParticipants,
  isLandscapeLayout,
  pinnedVideo,
}: {
  primaryContainerRef: RefObject<HTMLDivElement>;
  secondaryContainerRef: RefObject<HTMLDivElement>;
  videoParticipants: VideoParticipant[];
  isLandscapeLayout: boolean;
  pinnedVideo: VideoParticipant | undefined;
}) {
  const [videoLayout, setVideoLayout] = useState<VideoLayout[]>([]);
  const [panelOffset, setPanelOffset] = useState(0);
  const videosCount = videoParticipants.length;
  const prevVideosCount = usePreviousDeprecated(videosCount);
  const prevVideoParticipants = usePreviousDeprecated(videoParticipants);
  const removedVideoParticipants = useMemo(() => {
    return prevVideoParticipants?.filter(
      ({ id, type }) => !videoParticipants.some((p) => p.id === id && p.type === type),
    );
  }, [prevVideoParticipants, videoParticipants]);

  const recalculateLayout = useLastCallback(() => {
    const primaryContainer = primaryContainerRef.current;
    const secondaryContainer = secondaryContainerRef.current;
    if (!secondaryContainer) return;

    const removed = prevVideosCount !== undefined && prevVideosCount > videosCount
      ? prevVideosCount - videosCount : 0;

    const {
      x: secondaryInitialX,
      y: secondaryInitialY,
      width: secondaryContainerWidth,
    } = secondaryContainer.getBoundingClientRect();

    const layout: VideoLayout[] = [];
    if (pinnedVideo !== undefined || !primaryContainer || !isLandscapeLayout) {
      const isRemounted = true;
      let skip = false;
      let pinnedSkipIndex = 0;
      let pinnedPush: VideoLayout | undefined;
      let participants = videoParticipants;
      if (pinnedVideo && primaryContainer && isLandscapeLayout) {
        pinnedSkipIndex = participants
          .findIndex(({ id, type }) => id === pinnedVideo.id && type === pinnedVideo.type);
        if (pinnedSkipIndex !== -1) {
          const {
            x: initialX,
            y: initialY,
            width: containerWidth,
            height: containerHeight,
          } = primaryContainer.getBoundingClientRect();

          const { id: participantId, type } = pinnedVideo;

          pinnedPush = {
            x: initialX,
            y: initialY,
            width: containerWidth,
            height: containerHeight,
            participantId,
            type,
            orderKey: pinnedSkipIndex,
          };
          skip = true;
          participants = participants
            .filter(({ id, type: videoType }) => id !== participantId || videoType !== pinnedVideo.type);
        }
      }

      const secondaryVideosCounts = skip ? videosCount - 1 : videosCount;

      const isFirstBig = secondaryVideosCounts % 2 === 1;
      const columns = 2;
      const rows = Math.ceil(secondaryVideosCounts / columns);
      const smallWidth = (secondaryContainerWidth - (columns - 1) * PADDING_HORIZONTAL) / columns;
      const heightTotal = Math.max(0, isFirstBig
        ? (PREFERRED_PANEL_VIDEO_HEIGHT + (rows - 1) * smallWidth + (rows - 1) * PADDING_VERTICAL)
        : rows * smallWidth + (rows - 1) * PADDING_VERTICAL);

      for (let i = 0; i < secondaryVideosCounts; i++) {
        const isBig = isFirstBig && i === 0;
        const width = isBig ? secondaryContainerWidth : smallWidth;
        const height = isBig ? PREFERRED_PANEL_VIDEO_HEIGHT : smallWidth;

        const realIndex = isFirstBig && i !== 0 ? i + 1 : i;

        const x = (isRemounted ? 0 : secondaryInitialX) + (realIndex % columns) * (width + PADDING_HORIZONTAL);
        const y = (isRemounted ? 0 : secondaryInitialY) + (isFirstBig && i !== 0 ? (
          PREFERRED_PANEL_VIDEO_HEIGHT + PADDING_VERTICAL
          + (Math.floor(realIndex / columns) - 1) * (height + PADDING_VERTICAL)
        ) : (
          Math.floor(realIndex / columns) * (height + PADDING_VERTICAL)
        ));
        layout.push({
          x,
          y,
          width,
          height,
          shouldRemount: !isRemounted,
          isRemounted,
          noAnimate: true,
          participantId: participants[i].id,
          type: participants[i].type,
          orderKey: i >= pinnedSkipIndex ? i + 1 : i,
        });
      }

      if (pinnedPush) {
        layout.splice(pinnedSkipIndex, 0, pinnedPush);
      }

      if (removedVideoParticipants) {
        for (let i = 0; i < removed; i++) {
          layout.push({
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            isRemounted,
            isRemoved: true,
            participantId: removedVideoParticipants[i].id,
            type: removedVideoParticipants[i].type,
            orderKey: i + videosCount,
          });
        }
      }

      setPanelOffset(heightTotal);
      setVideoLayout(layout);
      return;
    }

    const {
      x: initialX,
      y: initialY,
      width: containerWidth,
      height: containerHeight,
    } = primaryContainer.getBoundingClientRect();

    const columns = calculateColumnsCount(videosCount);
    const rows = Math.ceil(videosCount / columns);
    const totalGridSize = rows * columns;
    const shouldFillLastRow = totalGridSize > videosCount;
    const width = (containerWidth - (columns - 1) * PADDING_HORIZONTAL) / columns;
    const height = (containerHeight - (rows - 1) * PADDING_VERTICAL) / rows;

    const lastRowWidth = width * (videosCount % columns);
    for (let i = 0; i < videosCount; i++) {
      const row = Math.floor(i / columns);
      const shouldCenter = shouldFillLastRow && row === rows - 1;
      const x = initialX + (i % columns) * (width + PADDING_HORIZONTAL)
        + (shouldCenter ? (containerWidth - lastRowWidth) / 2 : 0);
      const y = initialY + Math.floor(i / columns) * (height + PADDING_VERTICAL);
      layout.push({
        x,
        y,
        width,
        height,
        participantId: videoParticipants[i].id,
        type: videoParticipants[i].type,
        orderKey: i,
      });
    }

    if (removedVideoParticipants) {
      for (let i = 0; i < removed; i++) {
        layout.push({
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          isRemoved: true,
          participantId: removedVideoParticipants[i].id,
          type: removedVideoParticipants[i].type,
          orderKey: i + videosCount,
        });
      }
    }

    setPanelOffset(0);
    setVideoLayout(layout);
  });

  useEffect(recalculateLayout, [
    recalculateLayout, videoParticipants, isLandscapeLayout, pinnedVideo,
  ]);

  useResizeObserver(primaryContainerRef, recalculateLayout, !primaryContainerRef.current);
  useResizeObserver(secondaryContainerRef, recalculateLayout, !secondaryContainerRef.current);

  return {
    videoLayout, panelOffset,
  };
}

function calculateColumnsCount(videosCount: number) {
  if (videosCount >= 25) {
    return 5;
  } else if (videosCount >= 13) {
    return 4;
  } else if (videosCount >= 7) {
    return 3;
  } else if (videosCount >= 3) {
    return 2;
  } else {
    return 1;
  }
}
