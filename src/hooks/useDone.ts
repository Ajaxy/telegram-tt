import { useCallback } from '../lib/teact/teact';

import type { ApiChat } from '../api/types';

import { useStorage } from './useStorage';
// import useArchiver from './useArchiver';

export default function useDone() {
  // const { archiveChat } = useArchiver({ isManual: true });
  const { doneChatIds, setDoneChatIds } = useStorage();

  /*
  const doneChat = useCallback(({ id, value }: { id?: string; value?: boolean }) => {
    archiveChat({ id, value });
  }, [archiveChat]);
  */

  const doneChat = useCallback(({ id, value }: { id/* ? */: string; value/* ? */: boolean }) => {
    setDoneChatIds(value
      ? doneChatIds.filter((chatId: string) => chatId !== id)
      : [...doneChatIds, id]);
  }, [doneChatIds, setDoneChatIds]);

  const isChatDone = (chat: ApiChat) => {
    return doneChatIds.includes(chat.id);
  };

  return { doneChat, isChatDone };
}
