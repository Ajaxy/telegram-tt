import { MessageList, MessageListType } from '../global/types';
import { MAIN_THREAD_ID } from '../api/types';

export const createMessageHash = (messageList: MessageList): string => (
  messageList.chatId.toString()
  + (messageList.type !== 'thread' ? `_${messageList.type}`
    : (messageList.threadId !== -1 ? `_${messageList.threadId}` : ''))
);

export const parseMessageHash = (value: string): MessageList => {
  const [chatId, typeOrThreadId] = value.split('_');
  const isType = ['thread', 'pinned', 'scheduled'].includes(typeOrThreadId);

  return {
    chatId: Number(chatId),
    type: !!typeOrThreadId && isType ? (typeOrThreadId as MessageListType) : 'thread',
    threadId: !!typeOrThreadId && !isType ? Number(typeOrThreadId) : MAIN_THREAD_ID,
  };
};
