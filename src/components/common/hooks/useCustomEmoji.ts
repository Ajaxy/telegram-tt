import { useEffect, useState } from '../../../lib/teact/teact';
import { getGlobal } from '../../../global';

import type { ApiSticker } from '../../../api/types';
import type { GlobalState } from '../../../global/types';

import { selectCanPlayAnimatedEmojis } from '../../../global/selectors';
import { addCustomEmojiCallback, removeCustomEmojiCallback } from '../../../util/emoji/customEmojiManager';

import useEnsureCustomEmoji from '../../../hooks/useEnsureCustomEmoji';
import useLastCallback from '../../../hooks/useLastCallback';

export default function useCustomEmoji(documentId?: string) {
  const [customEmoji, setCustomEmoji] = useState<ApiSticker | undefined>(
    documentId ? getGlobal().customEmojis.byId[documentId] : undefined,
  );
  const [canPlay, setCanPlay] = useState(selectCanPlayAnimatedEmojis(getGlobal()));

  useEnsureCustomEmoji(documentId);

  const handleGlobalChange = useLastCallback((customEmojis?: GlobalState['customEmojis']) => {
    if (!documentId) return;

    const newGlobal = getGlobal();
    setCustomEmoji((customEmojis ?? newGlobal.customEmojis).byId[documentId]);
    setCanPlay(selectCanPlayAnimatedEmojis(newGlobal));
  });

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
