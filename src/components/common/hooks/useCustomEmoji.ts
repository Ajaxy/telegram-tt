import { useCallback, useEffect, useState } from '../../../lib/teact/teact';
import { getGlobal } from '../../../global';

import type { ApiSticker } from '../../../api/types';

import { addCustomEmojiCallback, removeCustomEmojiCallback } from '../../../util/customEmojiManager';

import useEnsureCustomEmoji from '../../../hooks/useEnsureCustomEmoji';

export default function useCustomEmoji(documentId: string) {
  const [customEmoji, setCustomEmoji] = useState<ApiSticker | undefined>(getGlobal().customEmojis.byId[documentId]);

  useEnsureCustomEmoji(documentId);

  const handleGlobalChange = useCallback(() => {
    setCustomEmoji(getGlobal().customEmojis.byId[documentId]);
  }, [documentId]);

  useEffect(handleGlobalChange, [documentId, handleGlobalChange]);

  useEffect(() => {
    if (customEmoji) return undefined;

    addCustomEmojiCallback(handleGlobalChange, documentId);

    return () => {
      removeCustomEmojiCallback(handleGlobalChange);
    };
  }, [customEmoji, documentId, handleGlobalChange]);

  return customEmoji;
}
