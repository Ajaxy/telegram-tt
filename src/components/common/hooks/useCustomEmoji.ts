import { useEffect, useState } from '../../../lib/teact/teact';
import { getGlobal } from '../../../global';

import type { ApiSticker } from '../../../api/types';
import type { GlobalState } from '../../../global/types';

import { selectCanPlayAnimatedEmojis, selectCustomEmoji } from '../../../global/selectors';
import { addCustomEmojiCallback, removeCustomEmojiCallback } from '../../../util/emoji/customEmojiManager';
import ensureCustomEmoji from '../../../util/emoji/ensureCustomEmoji';

import useLastCallback from '../../../hooks/useLastCallback';

export default function useCustomEmoji(documentId?: string) {
  const [customEmoji, setCustomEmoji] = useState<ApiSticker | undefined>(() => (
    documentId ? selectCustomEmoji(getGlobal(), documentId) : undefined
  ));
  const [canPlay, setCanPlay] = useState(() => selectCanPlayAnimatedEmojis(getGlobal()));

  const handleGlobalChange = useLastCallback((customEmojis?: GlobalState['customEmojis']) => {
    if (!documentId) return;

    const newGlobal = getGlobal();
    setCustomEmoji((customEmojis ?? newGlobal.customEmojis).byId[documentId]);
    setCanPlay(selectCanPlayAnimatedEmojis(newGlobal));
  });

  useEffect(() => {
    ensureCustomEmoji(documentId);
  }, [documentId]);

  useEffect(() => handleGlobalChange(), [documentId]);

  useEffect(() => {
    if (!documentId) return undefined;

    addCustomEmojiCallback(handleGlobalChange, documentId);

    return () => {
      removeCustomEmojiCallback(handleGlobalChange);
    };
  }, [documentId]);

  return { customEmoji, canPlay };
}
