import type { ApiChatType, ApiPhoto } from '../../api/types';

export function getBotCoverMediaHash(photo: ApiPhoto) {
  return `photo${photo.id}?size=x`;
}

export function convertToApiChatType(type: string): ApiChatType | undefined {
  if (type === 'channels') return 'channels';
  if (type === 'chats' || type === 'groups') return 'chats';
  if (type === 'users') return 'users';
  if (type === 'bots') return 'bots';
  return undefined;
}
