import type {
  ElementRef } from '../../../../lib/teact/teact';
import {
  useEffect, useLayoutEffect, useRef,
} from '../../../../lib/teact/teact';
import { getGlobal } from '../../../../global';

import type { ApiSticker } from '../../../../api/types';
import type { Signal } from '../../../../util/signals';

import { requestMeasure } from '../../../../lib/fasterdom/fasterdom';
import { ensureRLottie } from '../../../../lib/rlottie/RLottie.async';
import { selectCustomEmoji, selectIsAlwaysHighPriorityEmoji } from '../../../../global/selectors';
import AbsoluteVideo from '../../../../util/AbsoluteVideo';
import { hex2rgbaObj } from '../../../../util/colors.ts';
import {
  addCustomEmojiInputRenderCallback,
  getCustomEmojiMediaDataForInput,
} from '../../../../util/emoji/customEmojiManager';
import { round } from '../../../../util/math';
import { REM } from '../../../common/helpers/mediaDimensions';

import useColorFilter from '../../../../hooks/stickers/useColorFilter';
import useDynamicColorListener from '../../../../hooks/stickers/useDynamicColorListener';
import useEffectWithPrevDeps from '../../../../hooks/useEffectWithPrevDeps';
import useLastCallback from '../../../../hooks/useLastCallback';
import useResizeObserver from '../../../../hooks/useResizeObserver';
import useThrottledCallback from '../../../../hooks/useThrottledCallback';
import useBackgroundMode from '../../../../hooks/window/useBackgroundMode';
import useDevicePixelRatio from '../../../../hooks/window/useDevicePixelRatio';

const SIZE = 1.25 * REM;
const THROTTLE_MS = 300;

type CustomEmojiPlayer = {
  play: () => void;
  pause: () => void;
  destroy: () => void;
  updatePosition: (x: number, y: number) => void;
};

export default function useInputCustomEmojis(
  getHtml: Signal<string>,
  inputRef: ElementRef<HTMLDivElement>,
  sharedCanvasRef: ElementRef<HTMLCanvasElement>,
  sharedCanvasHqRef: ElementRef<HTMLCanvasElement>,
  absoluteContainerRef: ElementRef<HTMLElement>,
  prefixId: string,
  canPlayAnimatedEmojis: boolean,
  isReady?: boolean,
  isActive?: boolean,
) {
  const customColor = useDynamicColorListener(inputRef, undefined, !isReady);
  const colorFilter = useColorFilter(customColor, true);
  const dpr = useDevicePixelRatio();
  const playersById = useRef<Map<string, CustomEmojiPlayer>>(new Map());

  const clearPlayers = useLastCallback((ids: string[]) => {
    ids.forEach((id) => {
      const player = playersById.current.get(id);
      if (player) {
        player.destroy();
        playersById.current.delete(id);
      }
    });
  });

  const synchronizeElements = useLastCallback(() => {
    if (!isReady || !inputRef.current || !sharedCanvasRef.current || !sharedCanvasHqRef.current) return;

    const global = getGlobal();
    const playerIdsToClear = new Set(playersById.current.keys());
    const customEmojis = Array.from(inputRef.current.querySelectorAll<HTMLElement>('.custom-emoji'));

    customEmojis.forEach((element) => {
      if (!element.dataset.uniqueId) {
        return;
      }
      const playerId = `${prefixId}${element.dataset.uniqueId}${customColor || ''}`;
      const documentId = element.dataset.documentId!;

      playerIdsToClear.delete(playerId);

      const mediaUrl = getCustomEmojiMediaDataForInput(documentId);
      if (!mediaUrl) {
        return;
      }

      const canvasBounds = sharedCanvasRef.current!.getBoundingClientRect();
      const elementBounds = element.getBoundingClientRect();
      const x = round((elementBounds.left - canvasBounds.left) / canvasBounds.width, 4);
      const y = round((elementBounds.top - canvasBounds.top) / canvasBounds.height, 4);

      if (playersById.current.has(playerId)) {
        const player = playersById.current.get(playerId)!;
        player.updatePosition(x, y);
        return;
      }

      const customEmoji = selectCustomEmoji(global, documentId);
      if (!customEmoji) {
        return;
      }
      const isHq = customEmoji?.stickerSetInfo && selectIsAlwaysHighPriorityEmoji(global, customEmoji.stickerSetInfo);
      const renderId = [
        prefixId, documentId, customColor, dpr,
      ].filter(Boolean).join('_');

      createPlayer({
        customEmoji,
        sharedCanvasRef,
        sharedCanvasHqRef,
        absoluteContainerRef,
        renderId,
        viewId: playerId,
        mediaUrl,
        isHq,
        position: { x, y },
        textColor: customColor,
        colorFilter,
      }).then((animation) => {
        if (canPlayAnimatedEmojis) {
          animation.play();
        }

        playersById.current.set(playerId, animation);
      });
    });

    clearPlayers(Array.from(playerIdsToClear));
  });

  useEffect(() => {
    return addCustomEmojiInputRenderCallback(synchronizeElements);
  }, [synchronizeElements]);

  useEffect(() => {
    const activePlayersById = playersById.current;
    // Always clear players on unmount
    return () => {
      clearPlayers(Array.from(activePlayersById.keys()));
    };
  }, []);

  useEffect(() => {
    if (!getHtml() || !inputRef.current || !sharedCanvasRef.current || !isActive || !isReady) {
      clearPlayers(Array.from(playersById.current.keys()));
      return;
    }

    // Wait one frame for DOM to update
    requestMeasure(() => {
      synchronizeElements();
    });
  }, [getHtml, synchronizeElements, inputRef, clearPlayers, sharedCanvasRef, isActive, isReady]);

  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--input-custom-emoji-filter', colorFilter || 'none');
  }, [colorFilter]);

  useEffectWithPrevDeps(([prevCustomColor]) => {
    if (prevCustomColor !== undefined && customColor !== prevCustomColor) {
      synchronizeElements();
    }
  }, [customColor, synchronizeElements]);

  const throttledSynchronizeElements = useThrottledCallback(
    synchronizeElements,
    [synchronizeElements],
    THROTTLE_MS,
    false,
  );
  useResizeObserver(sharedCanvasRef, throttledSynchronizeElements);
  useEffectWithPrevDeps(([prevDpr]) => {
    if (dpr !== prevDpr) {
      clearPlayers(Array.from(playersById.current.keys()));
      synchronizeElements();
    }
  }, [dpr, synchronizeElements]);

  const freezeAnimation = useLastCallback(() => {
    playersById.current.forEach((player) => {
      player.pause();
    });
  });

  const unfreezeAnimation = useLastCallback(() => {
    if (!canPlayAnimatedEmojis) {
      return;
    }

    playersById.current?.forEach((player) => {
      player.play();
    });
  });

  const unfreezeAnimationOnRaf = useLastCallback(() => {
    requestMeasure(unfreezeAnimation);
  });

  // Pausing frame may not happen in background,
  // so we need to make sure it happens right after focusing,
  // then we can play again.
  useBackgroundMode(freezeAnimation, unfreezeAnimationOnRaf);
}

async function createPlayer({
  customEmoji,
  sharedCanvasRef,
  sharedCanvasHqRef,
  absoluteContainerRef,
  renderId,
  viewId,
  mediaUrl,
  position,
  isHq,
  textColor,
  colorFilter,
}: {
  customEmoji: ApiSticker;
  sharedCanvasRef: ElementRef<HTMLCanvasElement>;
  sharedCanvasHqRef: ElementRef<HTMLCanvasElement>;
  absoluteContainerRef: ElementRef<HTMLElement>;
  renderId: string;
  viewId: string;
  mediaUrl: string;
  position: { x: number; y: number };
  isHq?: boolean;
  textColor?: string;
  colorFilter?: string;
}): Promise<CustomEmojiPlayer> {
  if (customEmoji.isLottie) {
    const color = customEmoji.shouldUseTextColor && textColor ? hex2rgbaObj(textColor) : undefined;
    const RLottie = await ensureRLottie();
    const lottie = RLottie.init(
      mediaUrl,
      isHq ? sharedCanvasHqRef.current! : sharedCanvasRef.current!,
      renderId,
      {
        size: SIZE,
        coords: position,
        isLowPriority: !isHq,
      },
      viewId,
      color ? [color.r, color.g, color.b] : undefined,
    );

    return {
      play: () => lottie.play(),
      pause: () => lottie.pause(),
      destroy: () => lottie.removeView(viewId),
      updatePosition: (x: number, y: number) => {
        return lottie.setSharedCanvasCoords(viewId, { x, y });
      },
    };
  }

  if (customEmoji.isVideo) {
    const style = customEmoji.shouldUseTextColor && colorFilter ? `filter: ${colorFilter};` : undefined;
    const absoluteVideo = new AbsoluteVideo(
      mediaUrl,
      absoluteContainerRef.current!,
      { size: SIZE, position, style },
    );
    return {
      play: () => absoluteVideo.play(),
      pause: () => absoluteVideo.pause(),
      destroy: () => absoluteVideo.destroy(),
      updatePosition: (x: number, y: number) => absoluteVideo.updatePosition({ x, y }),
    };
  }

  throw new Error('Unsupported custom emoji type');
}
