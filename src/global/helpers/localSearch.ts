export function buildChatThreadKey(chatId: string, threadId: number) {
  return `${chatId}_${threadId}`;
}
