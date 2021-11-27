export interface GroupCallParticipant {
    isSelf?: boolean;
    isMuted?: boolean;
    isLeft?: boolean;
    isUser?: boolean;
    canSelfUnmute?: boolean;
    hasJustJoined?: boolean;
    isVideoJoined?: boolean;
    isMutedByMe?: boolean;
    isVolumeByAdmin?: boolean;
    isMin?: boolean;
    isVersioned?: boolean;
    source: number;
    date: Date;
    id: string;
    volume?: number;
    about?: string;
    video?: GroupCallParticipantVideo;
    presentation?: GroupCallParticipantVideo;
    raiseHandRating?: string;
    hasAudioStream?: boolean;
    hasVideoStream?: boolean;
    hasPresentationStream?: boolean;
    amplitude?: number;
}
export declare type GroupCallConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'discarded';
export interface GroupCallParticipantVideo {
    endpoint: string;
    isPaused?: boolean;
    sourceGroups: SsrcGroup[];
    audioSource?: number;
}
export declare type Fingerprint = {
    hash: string;
    setup: string;
    fingerprint: string;
};
export declare type SsrcGroup = {
    semantics: string;
    sources: number[];
};
export declare type Candidate = {
    generation: string;
    component: string;
    protocol: string;
    port: string;
    ip: string;
    foundation: string;
    id: string;
    priority: string;
    type: string;
    network: string;
    'rel-addr': string;
    'rel-port': string;
};
export declare type JoinGroupCallPayload = {
    ufrag: string;
    pwd: string;
    fingerprints: Fingerprint[];
    ssrc?: number;
    'ssrc-groups'?: SsrcGroup[];
};
export interface RTPExtension {
    id: number;
    uri: string;
}
export interface RTCPFeedbackParam {
    type: string;
    subtype?: string;
}
export interface PayloadType {
    id: number;
    name: string;
    clockrate: number;
    channels: number;
    parameters?: Record<string, string | number>;
    'rtcp-fbs'?: RTCPFeedbackParam[];
}
export interface GroupCallTransport {
    candidates: Candidate[];
    pwd: string;
    ufrag: string;
    fingerprints: Fingerprint[];
    'rtcp-mux': boolean;
    xmlns: string;
}
export interface GroupCallConnectionData {
    transport: GroupCallTransport;
    audio: {
        'payload-types': PayloadType[];
        'rtp-hdrexts': RTPExtension[];
    };
    video: {
        endpoint: string;
        'payload-types': PayloadType[];
        'rtp-hdrexts': RTPExtension[];
        server_sources: number[];
    };
    stream?: boolean;
}
