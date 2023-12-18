import type { ActionPayloads } from '../types';

import { addChatToCurrentWorkspaceTemp } from './workspaces';

export function processOpenChatOrThread(payload: ActionPayloads['processOpenChatOrThread']) {
  const { chatId } = payload;
  if (!chatId) return;

  addChatToCurrentWorkspaceTemp(chatId);
}
