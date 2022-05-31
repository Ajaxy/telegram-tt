import {
  useCallback, useEffect, useRef,
} from '../../../lib/teact/teact';
import safePlay from '../../../util/safePlay';
import { getActions } from '../../../global';
import useMedia from '../../../hooks/useMedia';
import type { ActiveEmojiInteraction } from '../../../global/types';
import { selectLocalAnimatedEmojiEffectByName } from '../../../global/selectors';

const SIZE = 104;
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

  const style = `width: ${SIZE}px; height: ${SIZE}px;`;

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
      startSize: SIZE,
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
    localEffect, messageId, play, sendInteractionBunch,
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
        startSize: SIZE,
        x,
        y,
        isReversed: !isOwn,
      });
      play();
    });
  }, [
    activeEmojiInteractions, chatId, emoji, isOwn, localEffect, messageId, play, sendWatchingEmojiInteraction,
  ]);

  return {
    ref,
    size: SIZE,
    style,
    handleClick,
  };
}
