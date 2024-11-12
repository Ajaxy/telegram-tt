import type { ApiPeer, ApiPeerColor } from '../../../api/types';
import type { CustomPeer } from '../../../types';

import { getPeerColorCount, getPeerColorKey } from '../../../global/helpers';

export function getPeerColorClass(peer?: ApiPeer | CustomPeer, noUserColors?: boolean, shouldReset?: boolean) {
  if (!peer) {
    if (!shouldReset) return undefined;
    return noUserColors ? 'peer-color-count-1' : 'peer-color-0';
  }

  if ('isCustomPeer' in peer) {
    if (peer.peerColorId === undefined) return undefined;
    return `peer-color-${peer.peerColorId}`;
  }
  return noUserColors ? `peer-color-count-${getPeerColorCount(peer)}` : `peer-color-${getPeerColorKey(peer)}`;
}

export function getApiPeerColorClass(color: ApiPeerColor) {
  return `peer-color-${color.color}`;
}
