import { GroupCallTransport, PayloadType, RTPExtension, SsrcGroup } from './types';
export declare type Conference = {
    sessionId: number;
    audioExtensions: RTPExtension[];
    videoExtensions: RTPExtension[];
    audioPayloadTypes: PayloadType[];
    videoPayloadTypes: PayloadType[];
    ssrcs: Ssrc[];
    transport: GroupCallTransport;
};
export declare type Ssrc = {
    userId: string;
    endpoint: string;
    isMain: boolean;
    isRemoved?: boolean;
    isVideo: boolean;
    isPresentation?: boolean;
    sourceGroups: SsrcGroup[];
};
declare const _default: (conference: Conference, isAnswer?: boolean, isPresentation?: boolean, isP2p?: boolean) => string;
export default _default;
