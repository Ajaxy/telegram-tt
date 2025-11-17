import type { IconName } from '../types/icons';

export const folderIconMap: Record<string, IconName> = {
  '🗂': 'folder-tabs-folder',
  '⭐': 'folder-tabs-star',
  '🤖': 'folder-tabs-bot',
  '👥': 'folder-tabs-group',
  '👤': 'folder-tabs-user',
  '✅': 'folder-tabs-chat',
  '📢': 'folder-tabs-channel',
  '💬': 'folder-tabs-chats',
};

export const emojiToFolderIcon = (emoji: string): IconName | undefined => {
  return folderIconMap[emoji];
};

export const folderIconToEmoji = (icon: IconName): string | undefined => {
  return Object.keys(folderIconMap).find((key) => folderIconMap[key] === icon);
};
