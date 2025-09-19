import type { MockTypes } from './MockTypes';

import Api from '../../tl/api';
import createMockedTypeInputPeer from './createMockedTypeInputPeer';

export default function createMockedDialogFilter(id: number, mockData: MockTypes) {
  const dialogFilter = mockData.dialogFilters.find((f) => f.id === id);

  if (!dialogFilter) throw Error('No such dialog filter ' + id);

  const {
    includePeerIds = [],
    pinnedPeerIds = [],
    excludePeerIds = [],
    ...rest
  } = dialogFilter;

  return new Api.DialogFilter({
    ...rest,
    id,
    includePeers: includePeerIds.map((peer) => createMockedTypeInputPeer(peer, mockData)),
    pinnedPeers: pinnedPeerIds.map((peer) => createMockedTypeInputPeer(peer, mockData)),
    excludePeers: excludePeerIds.map((peer) => createMockedTypeInputPeer(peer, mockData)),
  });
}
