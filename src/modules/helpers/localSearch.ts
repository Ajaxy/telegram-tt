export function buildChatThreadKey(chatId: number, threadId: number) {
  return `${chatId}_${threadId}`;
}
