import { useCallback, useEffect, useState } from '../../../lib/teact/teact';
import { getGlobal } from '../../../global';

import type { GlobalState } from '../../../global/types';
import type { ApiSticker } from '../../../api/types';

import { selectCanPlayAnimatedEmojis } from '../../../global/selectors';
import { addCustomEmojiCallback, removeCustomEmojiCallback } from '../../../util/customEmojiManager';

import useEnsureCustomEmoji from '../../../hooks/useEnsureCustomEmoji';

export default function useCustomEmoji(documentId?: string) {
  const global = getGlobal();
  const [customEmoji, setCustomEmoji] = useState<ApiSticker | undefined>(
    documentId ? global.customEmojis.byId[documentId] : undefined,
  );
  const [canPlay, setCanPlay] = useState(selectCanPlayAnimatedEmojis(global));

  useEnsureCustomEmoji(documentId);

  const handleGlobalChange = useCallback((customEmojis?: GlobalState['customEmojis']) => {
    if (!documentId) return;

    const newGlobal = getGlobal();
    setCustomEmoji((customEmojis ?? newGlobal.customEmojis).byId[documentId]);
    setCanPlay(selectCanPlayAnimatedEmojis(newGlobal));
  }, [documentId]);

  useEffect(handleGlobalChange, [documentId, handleGlobalChange]);

  useEffect(() => {
    if (!documentId) return undefined;

    addCustomEmojiCallback(handleGlobalChange, documentId);

    return () => {
      removeCustomEmojiCallback(handleGlobalChange);
    };
  }, [customEmoji, documentId, handleGlobalChange]);

  return { customEmoji, canPlay };
}
