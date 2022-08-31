import { useCallback, useEffect, useState } from '../../../lib/teact/teact';
import { addCallback } from '../../../lib/teact/teactn';
import { getGlobal } from '../../../global';

import type { GlobalState } from '../../../global/types';
import type { ApiSticker } from '../../../api/types';

const handlers = new Set<AnyToVoidFunction>();

let prevGlobal: GlobalState | undefined;

addCallback((global: GlobalState) => {
  const customEmojiById = global.customEmojis.byId;

  if (customEmojiById === prevGlobal?.customEmojis.byId) {
    return;
  }

  for (const handler of handlers) {
    handler();
  }

  prevGlobal = global;
});

export default function useCustomEmoji(documentId: string) {
  const [customEmoji, setCustomEmoji] = useState<ApiSticker | undefined>(getGlobal().customEmojis.byId[documentId]);

  const handleGlobalChange = useCallback(() => {
    setCustomEmoji(getGlobal().customEmojis.byId[documentId]);
  }, [documentId]);

  useEffect(() => {
    if (!documentId) return;
    handleGlobalChange();
  }, [documentId, handleGlobalChange]);

  useEffect(() => {
    if (customEmoji) return undefined;
    handlers.add(handleGlobalChange);

    return () => {
      handlers.delete(handleGlobalChange);
    };
  }, [customEmoji, documentId, handleGlobalChange]);

  return customEmoji;
}
