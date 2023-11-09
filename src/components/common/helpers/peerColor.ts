import type { ApiPeer } from '../../../api/types';

import { getPeerColorCount, getPeerColorKey } from '../../../global/helpers';

export function getPeerColorClass(peer?: ApiPeer, noUserColors?: boolean, shouldReset?: boolean) {
  if (!peer) {
    if (!shouldReset) return undefined;
    return noUserColors ? 'peer-color-count-1' : 'peer-color-0';
  }
  return noUserColors ? `peer-color-count-${getPeerColorCount(peer)}` : `peer-color-${getPeerColorKey(peer)}`;
}
