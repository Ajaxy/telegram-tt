import { useCallback } from '../lib/teact/teact';

import type { ApiChat } from '../api/types';

import useArchiver from './useArchiver';

export default function useDone() {
  const { archiveChat } = useArchiver({ isManual: true });

  const doneChat = useCallback(({ id, value }: { id?: string; value?: boolean }) => {
    archiveChat({ id, value });
  }, [archiveChat]);

  const isChatDone = (chat: ApiChat) => {
    const doneChats: string[] = [];
    return doneChats.includes(chat.id);
  };

  return { doneChat, isChatDone };
}
