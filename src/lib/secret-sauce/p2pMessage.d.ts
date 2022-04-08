import { Fingerprint, RTCPFeedbackParam, RTPExtension } from './types';
export declare type VideoState = 'inactive' | 'active' | 'suspended';
export declare type VideoRotation = 0 | 90 | 180 | 270;
export declare type MediaStateMessage = {
    '@type': 'MediaState';
    isMuted: boolean;
    videoState: VideoState;
    videoRotation: VideoRotation;
    screencastState: VideoState;
    isBatteryLow: boolean;
};
declare type CandidatesMessage = {
    '@type': 'Candidates';
    candidates: P2pCandidate[];
};
export declare type InitialSetupMessage = {
    '@type': 'InitialSetup';
    ufrag: string;
    pwd: string;
    fingerprints: Fingerprint[];
    audio?: MediaContent;
    video?: MediaContent;
    screencast?: MediaContent;
};
export declare type MediaContent = {
    ssrc: string;
    ssrcGroups: P2pSsrcGroup[];
    payloadTypes: P2PPayloadType[];
    rtpExtensions: RTPExtension[];
};
export interface P2PPayloadType {
    id: number;
    name: string;
    clockrate: number;
    channels: number;
    parameters?: Record<string, string>;
    feedbackTypes?: RTCPFeedbackParam[];
}
declare type P2pSsrcGroup = {
    semantics: string;
    ssrcs: number[];
};
declare type P2pCandidate = {
    sdpString: string;
};
export declare type P2pMessage = CandidatesMessage | InitialSetupMessage | MediaStateMessage;
export {};
