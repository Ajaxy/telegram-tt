import { GroupCallConnectionData, GroupCallParticipant, JoinGroupCallPayload } from './types';
export declare type StreamType = 'audio' | 'video' | 'presentation';
export declare function getDevices(streamType: StreamType, isInput?: boolean): Promise<MediaDeviceInfo[]>;
export declare function toggleSpeaker(): void;
export declare function toggleNoiseSuppression(): void;
export declare function getUserStreams(userId: string): {
    audio?: MediaStream | undefined;
    video?: MediaStream | undefined;
    presentation?: MediaStream | undefined;
} | undefined;
export declare function setVolume(userId: string, volume: number): void;
export declare function isStreamEnabled(streamType: StreamType, userId?: string): boolean;
export declare function switchCameraInput(): Promise<void>;
export declare function toggleStream(streamType: StreamType, value?: boolean | undefined): Promise<void>;
export declare function leaveGroupCall(): void;
export declare function handleUpdateGroupCallParticipants(updatedParticipants: GroupCallParticipant[]): Promise<void>;
export declare function handleUpdateGroupCallConnection(data: GroupCallConnectionData, isPresentation: boolean): Promise<void>;
export declare function startSharingScreen(): Promise<JoinGroupCallPayload | undefined>;
export declare function joinGroupCall(myId: string, audioContext: AudioContext, audioElement: HTMLAudioElement, onUpdate: (...args: any[]) => void): Promise<JoinGroupCallPayload>;
