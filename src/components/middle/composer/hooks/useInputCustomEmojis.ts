import {
  useCallback, useEffect, useRef,
} from '../../../../lib/teact/teact';
import RLottie from '../../../../lib/rlottie/RLottie';
import { requestMeasure } from '../../../../lib/fasterdom/fasterdom';

import type { ApiSticker } from '../../../../api/types';
import type { Signal } from '../../../../util/signals';

import { getGlobal } from '../../../../global';
import { selectIsAlwaysHighPriorityEmoji } from '../../../../global/selectors';
import {
  addCustomEmojiInputRenderCallback,
  getCustomEmojiMediaDataForInput,
  removeCustomEmojiInputRenderCallback,
} from '../../../../util/customEmojiManager';
import { round } from '../../../../util/math';
import AbsoluteVideo from '../../../../util/AbsoluteVideo';
import { REM } from '../../../common/helpers/mediaDimensions';

import useResizeObserver from '../../../../hooks/useResizeObserver';
import useBackgroundMode from '../../../../hooks/useBackgroundMode';
import useThrottledCallback from '../../../../hooks/useThrottledCallback';
import useDynamicColorListener from '../../../../hooks/useDynamicColorListener';
import useEffectWithPrevDeps from '../../../../hooks/useEffectWithPrevDeps';

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
  inputRef: React.RefObject<HTMLDivElement>,
  sharedCanvasRef: React.RefObject<HTMLCanvasElement>,
  sharedCanvasHqRef: React.RefObject<HTMLCanvasElement>,
  absoluteContainerRef: React.RefObject<HTMLElement>,
  prefixId: string,
  isActive?: boolean,
) {
  const { rgbColor: textColor } = useDynamicColorListener(inputRef);
  const playersById = useRef<Map<string, CustomEmojiPlayer>>(new Map());

  const clearPlayers = useCallback((ids: string[]) => {
    ids.forEach((id) => {
      const player = playersById.current.get(id);
      if (player) {
        player.destroy();
        playersById.current.delete(id);
      }
    });
  }, []);

  const synchronizeElements = useCallback(() => {
    if (!inputRef.current || !sharedCanvasRef.current || !sharedCanvasHqRef.current) return;
    const global = getGlobal();
    const playerIdsToClear = new Set(playersById.current.keys());
    const customEmojis = Array.from(inputRef.current.querySelectorAll<HTMLElement>('.custom-emoji'));

    customEmojis.forEach((element) => {
      if (!element.dataset.uniqueId) {
        return;
      }
      const playerId = `${prefixId}${element.dataset.uniqueId}${textColor?.join(',') || ''}`;
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

      const customEmoji = global.customEmojis.byId[documentId];
      if (!customEmoji) {
        return;
      }
      const isHq = customEmoji?.stickerSetInfo && selectIsAlwaysHighPriorityEmoji(global, customEmoji.stickerSetInfo);
      const renderId = [
        prefixId, documentId, textColor?.join(','),
      ].filter(Boolean).join('_');

      const animation = createPlayer({
        customEmoji,
        sharedCanvasRef,
        sharedCanvasHqRef,
        absoluteContainerRef,
        renderId,
        viewId: playerId,
        mediaUrl,
        isHq,
        position: { x, y },
        textColor,
      });
      animation.play();

      playersById.current.set(playerId, animation);
    });

    clearPlayers(Array.from(playerIdsToClear));
  }, [absoluteContainerRef, textColor, inputRef, prefixId, clearPlayers, sharedCanvasHqRef, sharedCanvasRef]);

  useEffect(() => {
    addCustomEmojiInputRenderCallback(synchronizeElements);

    return () => {
      removeCustomEmojiInputRenderCallback(synchronizeElements);
    };
  }, [synchronizeElements]);

  useEffect(() => {
    if (!getHtml() || !inputRef.current || !sharedCanvasRef.current || !isActive) {
      clearPlayers(Array.from(playersById.current.keys()));
      return;
    }

    // Wait one frame for DOM to update
    requestMeasure(() => {
      synchronizeElements();
    });
  }, [getHtml, synchronizeElements, inputRef, clearPlayers, sharedCanvasRef, isActive]);

  useEffectWithPrevDeps(([prevTextColor]) => {
    if (textColor !== prevTextColor) {
      synchronizeElements();
    }
  }, [textColor, synchronizeElements]);

  const throttledSynchronizeElements = useThrottledCallback(
    synchronizeElements,
    [synchronizeElements],
    THROTTLE_MS,
    false,
  );
  useResizeObserver(sharedCanvasRef, throttledSynchronizeElements);

  const freezeAnimation = useCallback(() => {
    playersById.current.forEach((player) => {
      player.pause();
    });
  }, []);

  const unfreezeAnimation = useCallback(() => {
    playersById.current.forEach((player) => {
      player.play();
    });
  }, []);

  const unfreezeAnimationOnRaf = useCallback(() => {
    requestMeasure(unfreezeAnimation);
  }, [unfreezeAnimation]);

  // Pausing frame may not happen in background,
  // so we need to make sure it happens right after focusing,
  // then we can play again.
  useBackgroundMode(freezeAnimation, unfreezeAnimationOnRaf);
}

function createPlayer({
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
}: {
  customEmoji: ApiSticker;
  sharedCanvasRef: React.RefObject<HTMLCanvasElement>;
  sharedCanvasHqRef: React.RefObject<HTMLCanvasElement>;
  absoluteContainerRef: React.RefObject<HTMLElement>;
  renderId: string;
  viewId: string;
  mediaUrl: string;
  position: { x: number; y: number };
  isHq?: boolean;
  textColor?: [number, number, number];
}): CustomEmojiPlayer {
  if (customEmoji.isLottie) {
    const lottie = RLottie.init(
      mediaUrl,
      isHq ? sharedCanvasHqRef.current! : sharedCanvasRef.current!,
      renderId,
      viewId,
      {
        size: SIZE,
        coords: position,
        isLowPriority: !isHq,
      },
      customEmoji.shouldUseTextColor ? textColor : undefined,
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
    const absoluteVideo = new AbsoluteVideo(mediaUrl, absoluteContainerRef.current!, { size: SIZE, position });
    return {
      play: () => absoluteVideo.play(),
      pause: () => absoluteVideo.pause(),
      destroy: () => absoluteVideo.destroy(),
      updatePosition: (x: number, y: number) => absoluteVideo.updatePosition({ x, y }),
    };
  }

  throw new Error('Unsupported custom emoji type');
}
