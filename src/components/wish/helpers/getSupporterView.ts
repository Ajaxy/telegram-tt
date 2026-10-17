import type { ApiUser } from '../../../api/types';
import type { CustomPeer } from '../../../types';
import type { LangFn } from '../../../util/localization';

import { getPeerTitle } from '../../../global/helpers/peers';
import { getDemoPerson } from '../../../api/wish/demoPeople';

export type SupporterView = {
  peer: ApiUser | CustomPeer;
  name: string;
  previewUrl?: string;
};

// A supporter is either a real user (the sender in the demo) or one of the fictional demo people
export function getSupporterView(
  lang: LangFn, userId: string, usersById: Record<string, ApiUser>,
): SupporterView | undefined {
  const user = usersById[userId];
  if (user) {
    return { peer: user, name: getPeerTitle(lang, user) || '' };
  }

  const person = getDemoPerson(userId);
  if (!person) return undefined;

  return {
    peer: { isCustomPeer: true, title: person.name, peerColorId: person.peerColorId },
    name: person.name,
    previewUrl: person.avatarUrl,
  };
}
