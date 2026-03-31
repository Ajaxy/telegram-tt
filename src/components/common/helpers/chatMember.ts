import type { ApiChatMember } from '../../../api/types';

export function hasRank(member?: ApiChatMember): boolean {
  return Boolean(member && (member.rank || member.isOwner || member.isAdmin));
}
