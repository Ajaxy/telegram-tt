import {
  useCallback, useEffect, useRef,
} from '../../../../lib/teact/teact';
import RLottie from '../../../../lib/rlottie/RLottie';

import type { ApiSticker } from '../../../../api/types';

import { getGlobal } from '../../../../global';
import { selectIsAlwaysHighPriorityEmoji } from '../../../../global/selectors';
import generateIdFor from '../../../../util/generateIdFor';
import {
  addCustomEmojiInputRenderCallback,
  getCustomEmojiMediaDataForInput,
  removeCustomEmojiInputRenderCallback,
} from '../../../../util/customEmojiManager';
import { round } from '../../../../util/math';
import { fastRaf } from '../../../../util/schedulers';
import AbsoluteVideo from '../../../../util/AbsoluteVideo';

import { useResizeObserver } from '../../../../hooks/useResizeObserver';
import useBackgroundMode from '../../../../hooks/useBackgroundMode';

const ID_STORE = {};
const SIZE = 20;

type Player = {
  play: () => void;
  pause: () => void;
  destroy: () => void;
  updatePosition: (x: number, y: number) => void;
};

export default function useInputCustomEmojis(
  html: string,
  inputRef: React.RefObject<HTMLDivElement>,
  sharedCanvasRef: React.RefObject<HTMLCanvasElement>,
  sharedCanvasHqRef: React.RefObject<HTMLCanvasElement>,
  absoluteContainerRef: React.RefObject<HTMLElement>,
) {
  const mapRef = useRef<Map<string, Player>>(new Map());

  const removeContainers = useCallback((ids: string[]) => {
    ids.forEach((id) => {
      const player = mapRef.current.get(id);
      if (player) {
        player.destroy();
        mapRef.current.delete(id);
      }
    });
  }, []);

  const synchronizeElements = useCallback(() => {
    if (!inputRef.current || !sharedCanvasRef.current || !sharedCanvasHqRef.current) return;
    const global = getGlobal();
    const removedContainers = new Set(mapRef.current.keys());
    const customEmojies = Array.from(inputRef.current.querySelectorAll<HTMLElement>('.custom-emoji'));

    customEmojies.forEach((element) => {
      const id = element.dataset.uniqueId!;
      const documentId = element.dataset.documentId!;
      if (!id) {
        return;
      }
      removedContainers.delete(id);

      const mediaUrl = getCustomEmojiMediaDataForInput(documentId);
      if (!mediaUrl) {
        return;
      }

      const canvasBounds = sharedCanvasRef.current!.getBoundingClientRect();
      const elementBounds = element.getBoundingClientRect();
      const x = round((elementBounds.left - canvasBounds.left) / canvasBounds.width, 4);
      const y = round((elementBounds.top - canvasBounds.top) / canvasBounds.height, 4);

      if (mapRef.current.has(id)) {
        const player = mapRef.current.get(id)!;
        player.updatePosition(x, y);
        return;
      }

      const customEmoji = global.customEmojis.byId[documentId];
      if (!customEmoji) {
        return;
      }
      const isHq = customEmoji?.stickerSetInfo && selectIsAlwaysHighPriorityEmoji(global, customEmoji.stickerSetInfo);

      const animation = createPlayer({
        customEmoji,
        sharedCanvasRef,
        sharedCanvasHqRef,
        absoluteContainerRef,
        uniqueId: id,
        mediaUrl,
        isHq,
        position: { x, y },
      });
      animation.play();

      mapRef.current.set(id, animation);
    });

    removeContainers(Array.from(removedContainers));
  }, [absoluteContainerRef, inputRef, removeContainers, sharedCanvasHqRef, sharedCanvasRef]);

  useEffect(() => {
    addCustomEmojiInputRenderCallback(synchronizeElements);

    return () => {
      removeCustomEmojiInputRenderCallback(synchronizeElements);
    };
  }, [synchronizeElements]);

  useEffect(() => {
    if (!html || !inputRef.current || !sharedCanvasRef.current) {
      removeContainers(Array.from(mapRef.current.keys()));
      return;
    }

    synchronizeElements();
  }, [html, inputRef, removeContainers, sharedCanvasRef, synchronizeElements]);

  useResizeObserver(sharedCanvasRef, synchronizeElements, true);

  const freezeAnimation = useCallback(() => {
    mapRef.current.forEach((player) => {
      player.pause();
    });
  }, []);

  const unfreezeAnimation = useCallback(() => {
    mapRef.current.forEach((player) => {
      player.play();
    });
  }, []);

  const unfreezeAnimationOnRaf = useCallback(() => {
    fastRaf(unfreezeAnimation);
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
  uniqueId,
  mediaUrl,
  position,
  isHq,
} : {
  customEmoji: ApiSticker;
  sharedCanvasRef: React.RefObject<HTMLCanvasElement>;
  sharedCanvasHqRef: React.RefObject<HTMLCanvasElement>;
  absoluteContainerRef: React.RefObject<HTMLElement>;
  uniqueId: string;
  mediaUrl: string;
  position: { x: number; y: number };
  isHq?: boolean;
}): Player {
  if (customEmoji.isLottie) {
    const lottie = RLottie.init(
      uniqueId,
      isHq ? sharedCanvasHqRef.current! : sharedCanvasRef.current!,
      undefined,
      generateIdFor(ID_STORE, true),
      mediaUrl,
      {
        size: SIZE,
        coords: position,
        isLowPriority: !isHq,
      },
    );
    return {
      play: () => lottie.play(),
      pause: () => lottie.pause(),
      destroy: () => lottie.removeContainer(uniqueId),
      updatePosition: (x: number, y: number) => lottie.setSharedCanvasCoords(uniqueId, { x, y }),
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
