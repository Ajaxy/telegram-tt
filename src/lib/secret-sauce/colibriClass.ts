export type EndpointConnectivityStatusChangeEvent = {
  colibriClass: 'EndpointConnectivityStatusChangeEvent';
  endpoint: string;
  active: boolean;
};

export type DominantSpeakerEndpointChangeEvent = {
  colibriClass: 'DominantSpeakerEndpointChangeEvent';
  dominantSpeakerEndpoint: string;
  previousSpeakers: string[];
};

export type SenderVideoConstraints = {
  colibriClass: 'SenderVideoConstraints';
  videoConstraints: {
    idealHeight: number;
  };
};

export type DebugMessage = {
  colibriClass: 'DebugMessage';
  message: string;
};

export type LastNEndpointsChangeEvent = {
  colibriClass: 'LastNEndpointsChangeEvent';
  lastNEndpoints: string[];
};

export type ReceiverVideoConstraints = {
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

export type ColibriClass = (
  LastNEndpointsChangeEvent | DebugMessage | EndpointConnectivityStatusChangeEvent |
  SenderVideoConstraints | DominantSpeakerEndpointChangeEvent | ReceiverVideoConstraints
);
