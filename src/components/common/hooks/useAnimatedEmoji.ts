import {
  useCallback, useEffect, useRef,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ActiveEmojiInteraction } from '../../../global/types';

import safePlay from '../../../util/safePlay';
import { selectLocalAnimatedEmojiEffectByName } from '../../../global/selectors';
import buildStyle from '../../../util/buildStyle';
import { REM } from '../helpers/mediaDimensions';

import useMedia from '../../../hooks/useMedia';

const SIZE = 7 * REM;
const INTERACTION_BUNCH_TIME = 1000;
const MS_DIVIDER = 1000;
const TIME_DEFAULT = 0;

export default function useAnimatedEmoji(
  chatId?: string,
  messageId?: number,
  soundId?: string,
  activeEmojiInteractions?: ActiveEmojiInteraction[],
  isOwn?: boolean,
  localEffect?: string,
  emoji?: string,
  preferredSize?: number,
) {
  const {
    interactWithAnimatedEmoji, sendEmojiInteraction, sendWatchingEmojiInteraction,
  } = getActions();

  const hasEffect = localEffect || emoji;

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line no-null/no-null
  const audioRef = useRef<HTMLAudioElement | undefined>(null);

  const soundMediaData = useMedia(soundId ? `document${soundId}` : undefined, !soundId);

  const size = preferredSize || SIZE;
  const style = buildStyle(`width: ${size}px`, `height: ${size}px`, (emoji || localEffect) && 'cursor: pointer');

  const interactions = useRef<number[] | undefined>(undefined);
  const startedInteractions = useRef<number | undefined>(undefined);
  const sendInteractionBunch = useCallback(() => {
    const container = ref.current;

    if (!container) return;

    sendEmojiInteraction({
      chatId,
      messageId,
      localEffect,
      emoji,
      interactions: interactions.current,
    });
    startedInteractions.current = undefined;
    interactions.current = undefined;
  }, [sendEmojiInteraction, chatId, messageId, localEffect, emoji]);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (soundMediaData) {
      if (audio) {
        audio.pause();
        audio.remove();
      }
      audioRef.current = new Audio();
      audioRef.current.src = soundMediaData;
      safePlay(audioRef.current);
      audioRef.current.addEventListener('ended', () => {
        audioRef.current = undefined;
      }, { once: true });
    }
  }, [soundMediaData]);

  const handleClick = useCallback(() => {
    play();

    const container = ref.current;

    if (!hasEffect || !container || !messageId || !chatId) {
      return;
    }

    const { x, y } = container.getBoundingClientRect();

    interactWithAnimatedEmoji({
      localEffect,
      emoji,
      x,
      y,
      startSize: size,
      isReversed: !isOwn,
    });

    if (!interactions.current) {
      interactions.current = [];
      startedInteractions.current = performance.now();
      setTimeout(sendInteractionBunch, INTERACTION_BUNCH_TIME);
    }

    interactions.current.push(startedInteractions.current
      ? (performance.now() - startedInteractions.current) / MS_DIVIDER
      : TIME_DEFAULT);
  }, [
    chatId, emoji, hasEffect, interactWithAnimatedEmoji, isOwn,
    localEffect, messageId, play, sendInteractionBunch, size,
  ]);

  // Set an end anchor for remote activated interaction
  useEffect(() => {
    const container = ref.current;

    if (!container || !activeEmojiInteractions) return;

    activeEmojiInteractions.forEach(({
      id,
      startSize,
      messageId: interactionMessageId,
    }) => {
      if (startSize || messageId !== interactionMessageId) {
        return;
      }

      const { x, y } = container.getBoundingClientRect();

      sendWatchingEmojiInteraction({
        id,
        chatId,
        emoticon: localEffect ? selectLocalAnimatedEmojiEffectByName(localEffect) : emoji,
        startSize: size,
        x,
        y,
        isReversed: !isOwn,
      });
      play();
    });
  }, [
    activeEmojiInteractions, chatId, emoji, isOwn, localEffect, messageId, play, sendWatchingEmojiInteraction, size,
  ]);

  return {
    ref,
    size,
    style,
    handleClick,
  };
}
