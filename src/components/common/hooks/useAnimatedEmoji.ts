import { useEffect, useRef } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ActiveEmojiInteraction } from '../../../types';

import buildStyle from '../../../util/buildStyle';
import safePlay from '../../../util/safePlay';
import { IS_ELECTRON } from '../../../util/windowEnvironment';
import { REM } from '../helpers/mediaDimensions';

import useLastCallback from '../../../hooks/useLastCallback';
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
  emoji?: string,
  preferredSize?: number,
) {
  const {
    interactWithAnimatedEmoji, sendEmojiInteraction, sendWatchingEmojiInteraction,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line no-null/no-null
  const audioRef = useRef<HTMLAudioElement | undefined>(null);

  const soundMediaData = useMedia(soundId ? `document${soundId}` : undefined, !soundId);

  const size = preferredSize || SIZE;
  const style = buildStyle(`width: ${size}px`, `height: ${size}px`, emoji && !IS_ELECTRON && 'cursor: pointer');

  const interactions = useRef<number[] | undefined>(undefined);
  const startedInteractions = useRef<number | undefined>(undefined);
  const sendInteractionBunch = useLastCallback(() => {
    const container = ref.current;

    if (!container) return;

    sendEmojiInteraction({
      chatId: chatId!,
      messageId: messageId!,
      emoji: emoji!,
      interactions: interactions.current!,
    });
    startedInteractions.current = undefined;
    interactions.current = undefined;
  });

  const play = useLastCallback(() => {
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
  });

  const handleClick = useLastCallback(() => {
    play();

    const container = ref.current;

    if (!emoji || !container || !messageId || !chatId) {
      return;
    }

    const { x, y } = container.getBoundingClientRect();

    interactWithAnimatedEmoji({
      emoji: emoji!,
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
  });

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
        chatId: chatId!,
        emoticon: emoji!,
        startSize: size,
        x,
        y,
        isReversed: !isOwn,
      });
      play();
    });
  }, [activeEmojiInteractions, chatId, emoji, isOwn, messageId, play, sendWatchingEmojiInteraction, size]);

  return {
    ref,
    size,
    style,
    handleClick,
  };
}
