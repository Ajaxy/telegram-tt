import {
  useCallback, useEffect, useRef, useState,
} from '../../../lib/teact/teact';
import safePlay from '../../../util/safePlay';
import { getActions } from '../../../global';
import useMedia from '../../../hooks/useMedia';
import { ActiveEmojiInteraction } from '../../../global/types';
import useFlag from '../../../hooks/useFlag';
import { selectLocalAnimatedEmojiEffectByName } from '../../../global/selectors';

const WIDTH = {
  large: 160,
  medium: 128,
  small: 104,
};
const INTERACTION_BUNCH_TIME = 1000;
const MS_DIVIDER = 1000;
const TIME_DEFAULT = 0;

export default function useAnimatedEmoji(
  size: 'large' | 'medium' | 'small',
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
  const [isAnimationLoaded, markAnimationLoaded] = useFlag();

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line no-null/no-null
  const audioRef = useRef<HTMLAudioElement | undefined>(null);

  const soundMediaData = useMedia(soundId ? `document${soundId}` : undefined, !soundId);

  const width = WIDTH[size];
  const style = `width: ${width}px; height: ${width}px;`;

  const [playKey, setPlayKey] = useState(String(Math.random()));
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
    setPlayKey(String(Math.random()));

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
      startSize: width,
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
    localEffect, messageId, play, sendInteractionBunch, width,
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
        startSize: width,
        x,
        y,
        isReversed: !isOwn,
      });
      play();
    });
  }, [
    activeEmojiInteractions, chatId, emoji, isOwn, localEffect, messageId, play, sendWatchingEmojiInteraction, width,
  ]);

  return {
    playKey,
    ref,
    style,
    width,
    handleClick,
    markAnimationLoaded,
    isAnimationLoaded,
  };
}
