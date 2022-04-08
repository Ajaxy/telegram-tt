import { ApiPhoneCallConnection } from './types';
import { P2pMessage } from './p2pMessage';
import { StreamType } from './secretsauce';
export declare function getStreams(): {
    video?: MediaStream | undefined;
    audio?: MediaStream | undefined;
    presentation?: MediaStream | undefined;
    ownAudio?: MediaStream | undefined;
    ownVideo?: MediaStream | undefined;
    ownPresentation?: MediaStream | undefined;
} | undefined;
export declare function switchCameraInputP2p(): Promise<void>;
export declare function toggleStreamP2p(streamType: StreamType, value?: boolean | undefined): Promise<void>;
export declare function joinPhoneCall(connections: ApiPhoneCallConnection[], emitSignalingData: (data: P2pMessage) => void, isOutgoing: boolean, shouldStartVideo: boolean, onUpdate: (...args: any[]) => void): Promise<void>;
export declare function stopPhoneCall(): void;
export declare function processSignalingMessage(message: P2pMessage): Promise<void>;
