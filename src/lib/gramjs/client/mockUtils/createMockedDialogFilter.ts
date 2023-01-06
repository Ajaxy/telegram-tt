import Api from "../../tl/api";
import {MockTypes} from "./MockTypes";
import createMockedTypeInputPeer from "./createMockedTypeInputPeer";

export default function createMockedDialogFilter(id: number, mockData: MockTypes) {
    const dialogFilter = mockData.dialogFilters.find(dialogFilter => dialogFilter.id === id);

    if(!dialogFilter) throw Error("No such dialog filter " + id);

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
