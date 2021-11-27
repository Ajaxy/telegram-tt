export declare type EndpointConnectivityStatusChangeEvent = {
    colibriClass: 'EndpointConnectivityStatusChangeEvent';
    endpoint: string;
    active: boolean;
};
export declare type DominantSpeakerEndpointChangeEvent = {
    colibriClass: 'DominantSpeakerEndpointChangeEvent';
    dominantSpeakerEndpoint: string;
    previousSpeakers: string[];
};
export declare type SenderVideoConstraints = {
    colibriClass: 'SenderVideoConstraints';
    videoConstraints: {
        idealHeight: number;
    };
};
export declare type DebugMessage = {
    colibriClass: 'DebugMessage';
    message: string;
};
export declare type LastNEndpointsChangeEvent = {
    colibriClass: 'LastNEndpointsChangeEvent';
    lastNEndpoints: string[];
};
export declare type ReceiverVideoConstraints = {
    colibriClass: 'ReceiverVideoConstraints';
    defaultConstraints: {
        maxHeight: number;
    };
    constraints: Record<string, {
        minHeight: number;
        maxHeight: number;
    }>;
    onStageEndpoints: string[];
};
export declare type ColibriClass = (LastNEndpointsChangeEvent | DebugMessage | EndpointConnectivityStatusChangeEvent | SenderVideoConstraints | DominantSpeakerEndpointChangeEvent | ReceiverVideoConstraints);
