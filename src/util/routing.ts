import { MessageList, MessageListType } from '../global/types';
import { MAIN_THREAD_ID } from '../api/types';

export const createMessageHash = (messageList: MessageList): string => (
  messageList.chatId.toString()
  + (messageList.type !== 'thread' ? `_${messageList.type}`
    : (messageList.threadId !== -1 ? `_${messageList.threadId}` : ''))
);

export const parseLocationHash = (value: string): MessageList | undefined => {
  if (!value) return undefined;

  const [chatId, typeOrThreadId] = value.replace(/^#/, '').split('_');

  if (!chatId) return undefined;

  const isType = ['thread', 'pinned', 'scheduled'].includes(typeOrThreadId);

  return {
    chatId,
    type: Boolean(typeOrThreadId) && isType ? (typeOrThreadId as MessageListType) : 'thread',
    threadId: Boolean(typeOrThreadId) && !isType ? Number(typeOrThreadId) : MAIN_THREAD_ID,
  };
};
