import parseSdp from './parseSdp';
import { ColibriClass } from './colibriClass';
import type {
  GroupCallConnectionData, GroupCallConnectionState, GroupCallParticipant, JoinGroupCallPayload,
} from './types';
import buildSdp, { Conference, Ssrc } from './buildSdp';
import { black, silence } from './blacksilence';
import {
  getAmplitude,
  IS_ECHO_CANCELLATION_SUPPORTED,
  IS_NOISE_SUPPRESSION_SUPPORTED,
  THRESHOLD,
} from './utils';
import Deferred from "../../util/Deferred";
import safePlay from "../../util/safePlay";

export type StreamType = 'audio' | 'video' | 'presentation';
const DEFAULT_MID = 3;
type GroupCallState = {
  connection?: RTCPeerConnection;
  screenshareConnection?: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  screenshareDataChannel?: RTCDataChannel;
  participants?: GroupCallParticipant[];
  conference?: Partial<Conference>;
  screenshareConference?: Partial<Conference>;
  streams?: Record<string, {
    audio?: MediaStream;
    video?: MediaStream;
    presentation?: MediaStream;
  }>;
  participantFunctions?: Record<string, {
    setVolume?: (volume: number) => void;
    toggleMute?: (muted: boolean) => void;
    getCurrentAmplitude?: () => number;
  }>;
  onUpdate?: (...args: any[]) => void;
  myId?: string;
  black?: MediaStream;
  silence?: MediaStream;
  updatingParticipantsQueue?: any[];
  facingMode?: VideoFacingModeEnum;
  isSpeakerDisabled?: boolean;
  analyserInterval?: number;
  speaking?: Record<string, number>;
  audioElement?: HTMLAudioElement;
  destination?: MediaStreamAudioDestinationNode;
  audioContext?: AudioContext;
  mediaStream?: MediaStream;
  lastMid: number;
  audioStream?: MediaStream;
  audioSource?: MediaStreamAudioSourceNode;
  audioAnalyser?: AnalyserNode;
};

let state: GroupCallState | undefined;

export async function getDevices(streamType: StreamType, isInput = true) {
  return (await navigator.mediaDevices.enumerateDevices())
    .filter((l) => l.kind === `${streamType}${isInput ? 'input' : 'output'}`);
}

export function toggleSpeaker() {
  if (!state) {
    return;
  }

  state.isSpeakerDisabled = !state.isSpeakerDisabled;
  state?.onUpdate?.({
    '@type': 'updateGroupCallConnectionState',
    connectionState: 'connected',
    isSpeakerDisabled: state.isSpeakerDisabled,
  });
  if (state.participantFunctions) {
    Object.values(state.participantFunctions).forEach((l) => {
      l.toggleMute?.(!!state?.isSpeakerDisabled);
    });
  }
}

function leavePresentation(isFromToggle?: boolean) {
  if (!state) {
    return;
  }
  state.screenshareDataChannel?.close();
  state.screenshareConnection?.close();

  if (!isFromToggle) {
    state.onUpdate?.({
      '@type': 'updateGroupCallLeavePresentation',
    });
  }
}

export function toggleNoiseSuppression() {
  if (!state || !state.myId || !state.streams) {
    return;
  }

  const audioStream = state.streams[state.myId].audio;
  if (!audioStream) {
    return;
  }

  const track = audioStream.getTracks()[0];

  if (!track) {
    return;
  }

  // @ts-ignore
  const { echoCancellation, noiseSuppression } = track.getConstraints();

  track.applyConstraints({
    echoCancellation: !echoCancellation,
    // @ts-ignore
    noiseSuppression: !noiseSuppression,
  });
}

export function getUserStreams(userId: string) {
  return state?.streams?.[userId];
}

export function setVolume(userId: string, volume: number) {
  const participantFunctions = state?.participantFunctions?.[userId];
  if (!participantFunctions) return;
  participantFunctions.setVolume?.(volume);
}

export function isStreamEnabled(streamType: StreamType, userId?: string) {
  const id = userId || state?.myId;
  const stream = id && getUserStreams(id)?.[streamType];
  if (!stream) return false;

  return stream.getTracks()[0]?.enabled;
}

function updateGroupCallStreams(userId: string) {
  state?.onUpdate?.({
    '@type': 'updateGroupCallStreams',
    userId,
    hasAudioStream: isStreamEnabled('audio', userId),
    hasVideoStream: isStreamEnabled('video', userId),
    hasPresentationStream: isStreamEnabled('presentation', userId),
    amplitude: state.speaking?.[userId],
  });
}

async function getUserStream(streamType: StreamType, facing: VideoFacingModeEnum = 'user') {
  if (streamType === 'audio' && state?.audioStream) {
    return state.audioStream;
  }

  if (streamType === 'presentation') {
    return (navigator.mediaDevices as any).getDisplayMedia({
      audio: false,
      video: true,
    });
  }

  const media = await navigator.mediaDevices.getUserMedia({
    audio: streamType === 'audio' ? {
      // @ts-ignore
      ...(IS_ECHO_CANCELLATION_SUPPORTED && {echoCancellation: true}),
      ...(IS_NOISE_SUPPRESSION_SUPPORTED && {noiseSuppression: true}),
    } : false,
    video: streamType === 'video' ? {
      facingMode: facing,
    } : false,
  });

  if (state && streamType === 'audio') {
    state.audioStream = media;
  }

  if (streamType === 'video') {
    const vid = document.createElement('video');
    vid.srcObject = media;

    const deferred = new Deferred();
    vid.oncanplay = () => deferred.resolve();
    await deferred.promise;
  }

  return media;
}

export async function switchCameraInput() {
  if (!state?.myId || !state.connection || !state.streams || !state.facingMode) {
    return;
  }

  const stream = getUserStreams(state.myId)?.video;

  if (!stream) return;

  const track = stream.getTracks()[0];

  if (!track) {
    return;
  }

  const sender = state.connection.getSenders().find((l) => track.id === l.track?.id);

  if (!sender) {
    return;
  }

  state.facingMode = state.facingMode === 'environment' ? 'user' : 'environment';
  try {
    const newStream = await getUserStream('video', state.facingMode);

    await sender.replaceTrack(newStream.getTracks()[0]);
    state.streams[state.myId].video = newStream;
  } catch (e) {

  }
}

export async function toggleStream(streamType: StreamType, value: boolean | undefined = undefined) {
  if (!state || !state.myId || !state.connection || !state.streams) {
    return;
  }

  const stream = getUserStreams(state.myId)?.[streamType];
  if (!stream) return;

  const track = stream.getTracks()[0];

  if (!track) {
    return;
  }

  const sender = [
    ...state.connection.getSenders(),
    ...(state.screenshareConnection?.getSenders() || []),
  ].find((l) => track.id === l.track?.id);

  if (!sender) {
    return;
  }

  value = value === undefined ? !track.enabled : value;

  try {
    if (value && !track.enabled) {
      const newStream = await getUserStream(streamType);
      await sender.replaceTrack(newStream.getTracks()[0]);
      state.streams[state.myId][streamType] = newStream;
      if (streamType === 'video') {
        state.facingMode = 'user';
      } else if (streamType === 'audio') {
        const { audioContext } = state;
        if (!audioContext) return;
        const source = state.audioSource || audioContext.createMediaStreamSource(newStream);

        const analyser = state.audioAnalyser || audioContext.createAnalyser();
        analyser.minDecibels = -100;
        analyser.maxDecibels = -30;
        analyser.smoothingTimeConstant = 0.05;
        analyser.fftSize = 1024;

        source.connect(analyser);

        state = {
          ...state,
          audioSource: source,
          audioAnalyser: analyser,
          participantFunctions: {
            ...state.participantFunctions,
            [state.myId]: {
              ...state.participantFunctions?.[state.myId],
              getCurrentAmplitude: () => {
                const array = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(array);
                return getAmplitude(array, 1.5);
              },
            },
          },
        };
      }
    } else if (!value && track.enabled) {
      const newStream = streamType === 'audio' ? state.silence : state.black;
      if (!newStream) return;

      await sender.replaceTrack(newStream.getTracks()[0]);
      state.streams[state.myId][streamType] = newStream;
      if (streamType === 'video') {
        state.facingMode = undefined;
      }

      if(streamType !== 'audio') {
        // We only want to stop video streams
        track.stop();
      } else {
        state.audioSource?.disconnect();
        state.audioAnalyser?.disconnect();
      }
    }
    updateGroupCallStreams(state.myId!);
    if (streamType === 'presentation' && !value) leavePresentation(true);
  } catch (e) {

  }
}

function updateConnectionState(connectionState: GroupCallConnectionState) {
  state?.onUpdate?.({
    '@type': 'updateGroupCallConnectionState',
    connectionState,
  });
}

export function leaveGroupCall() {
  if (!state) {
    return;
  }

  if (state.myId && state.streams?.[state.myId]) {
    Object.values(state.streams[state.myId] || {}).forEach((stream) => {
      stream?.getTracks().forEach((track) => {
        track.stop();
      });
    });
  }

  state.audioStream?.getTracks().forEach((track) => {
    track.stop();
  });
  leavePresentation(true);
  state.dataChannel?.close();
  state.connection?.close();
  updateConnectionState('disconnected');

  if (state.analyserInterval) {
    clearInterval(state.analyserInterval);
  }

  state = undefined;
}

function analyzeAmplitudes() {
  if (!state || !state.participantFunctions) return;

  Object.keys(state.participantFunctions).forEach((id) => {
    const { getCurrentAmplitude } = state!.participantFunctions![Number(id)];

    if (getCurrentAmplitude) {
      const amplitude = getCurrentAmplitude();
      const prevAmplitude = state!.speaking![id] || 0;
      state!.speaking![id] = amplitude;
      if ((amplitude > THRESHOLD && prevAmplitude <= THRESHOLD)
        || (amplitude <= THRESHOLD && prevAmplitude > THRESHOLD)) {
        updateGroupCallStreams(id);
      }
    }
  });
}

function createDataChannel(connection: RTCPeerConnection) {
  const dataChannel = connection.createDataChannel('data', {
    id: 0,
  });

  dataChannel.onopen = () => {
    // console.log('Data channel open!');
  };

  dataChannel.onmessage = (e) => {
    // console.log('onmessage');
    const data = JSON.parse(e.data) as ColibriClass;
    // console.log(data);
    switch (data.colibriClass) {
      case 'DominantSpeakerEndpointChangeEvent':
        break;
      case 'SenderVideoConstraints':

        break;
      case 'EndpointConnectivityStatusChangeEvent':

        break;
    }
  };

  dataChannel.onerror = (e) => {
    console.log('%conerror', 'background: green; font-size: 5em');
    console.error(e);
  };

  return dataChannel;
}

export async function handleUpdateGroupCallParticipants(updatedParticipants: GroupCallParticipant[]) {
  if (!state) {
    return;
  }

  const {
    participants, conference, connection, myId,
  } = state;

  if (!participants || !conference || !connection || !conference.ssrcs || !conference.transport || !myId) {
    return;
  }

  // Joined from another client
  if (updatedParticipants.find((participant) => {
    return participant.isSelf
      && participant.source
      !== state?.conference?.ssrcs?.find((l) => l.isMain && !l.isVideo)?.sourceGroups[0].sources[0];
  })) {
    leaveGroupCall();
    return;
  }

  const newEndpoints: string[] = [];
  updatedParticipants.forEach((participant) => {
    if (participant.isSelf) {
      if (participant.isMuted && !participant.canSelfUnmute) {
        // Muted by admin
        toggleStream('audio', false);
        toggleStream('video', false);
        toggleStream('presentation', false);
      }
      return;
    }

    const { isLeft } = participant;
    const isAudioLeft = participant.isMuted || participant.isMutedByMe;
    const isVideoLeft = !participant.isVideoJoined || !participant.video || isLeft;
    const isPresentationLeft = !participant.presentation || isLeft;

    let hasVideo = false;
    let hasAudio = false;
    let hasPresentation = false;

    conference.ssrcs!.filter((l) => l.userId === participant.id).forEach((ssrc) => {
      if (!ssrc.isVideo) {
        if (ssrc.sourceGroups[0].sources[0] === participant.source) {
          hasAudio = true;
        }
        // console.log('has audio, removed=', isAudioLeft);
        ssrc.isRemoved = isAudioLeft;
      }

      if (ssrc.isVideo) {
        if (!ssrc.isPresentation) {
          if (!!participant.video && ssrc.endpoint === participant.video.endpoint) {
            hasVideo = true;
          }
          // console.log('has video = ', hasVideo, ' removed=', isVideoLeft);
          ssrc.isRemoved = isVideoLeft;
        }

        if (ssrc.isPresentation) {
          if (!!participant.presentation && ssrc.endpoint === participant.presentation.endpoint) {
            hasPresentation = true;
          }
          // console.log('has presentation, removed=', isPresentationLeft);
          ssrc.isRemoved = isPresentationLeft;
        }
      }
    });

    if (!isAudioLeft && !hasAudio) {
      // console.log('add audio');
      state!.lastMid = state!.lastMid + 1;
      conference.ssrcs!.push({
        userId: participant.id,
        isMain: false,
        endpoint: `audio${participant.source}`,
        isVideo: false,
        sourceGroups: [{
          sources: [participant.source],
        }],
        mid: state!.lastMid.toString()
      });
    }

    if (!isVideoLeft && !hasVideo && participant.video) {
      // console.log('add video', participant.video);
      state!.lastMid = state!.lastMid + 1;

      newEndpoints.push(participant.video.endpoint);
      conference.ssrcs!.push({
        userId: participant.id,
        isMain: false,
        endpoint: participant.video.endpoint,
        isVideo: true,
        sourceGroups: participant.video.sourceGroups,
        mid: state!.lastMid.toString()
      });
    }

    if (!isPresentationLeft && !hasPresentation && participant.presentation) {
      // console.log('add presentation');
      state!.lastMid = state!.lastMid + 1;
      conference.ssrcs!.push({
        isPresentation: true,
        userId: participant.id,
        isMain: false,
        endpoint: participant.presentation.endpoint,
        isVideo: true,
        sourceGroups: participant.presentation.sourceGroups,
        mid: state!.lastMid.toString()
      });
    }
  });

  if (state.updatingParticipantsQueue) {
    state.updatingParticipantsQueue.push(conference);
    return;
  } else {
    state.updatingParticipantsQueue = [];
  }

  const sdp = buildSdp(conference as Conference);
  await connection.setRemoteDescription({
    type: 'offer',
    sdp,
  });

  try {
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);

    updateGroupCallStreams(myId);
    if (state.updatingParticipantsQueue.length > 0) {
      // eslint-disable-next-line no-restricted-syntax
      for (const newConference of state.updatingParticipantsQueue) {
        await connection.setRemoteDescription({
          type: 'offer',
          sdp: buildSdp(newConference as Conference),
        });
        const answerNew = await connection.createAnswer();
        await connection.setLocalDescription(answerNew);
        updateGroupCallStreams(myId);

        // if (newEndpoints.length > 0) {
        //   sendDataChannelMessage({
        //     colibriClass: 'ReceiverVideoConstraints',
        //     defaultConstraints: {
        //       maxHeight: 0,
        //     },
        //     constraints: {
        //       ...(newEndpoints.reduce((acc: Record<string, any>, el) => {
        //         acc[el] = {
        //           minHeight: 0,
        //           maxHeight: 1080,
        //         };
        //         return acc;
        //       }, {})),
        //     },
        //     onStageEndpoints: [],
        //   });
        // }
      }
    }
    state.updatingParticipantsQueue = undefined;
  } catch (e) {
    console.error(e);
  }
}
//
// function sendDataChannelMessage(message: ColibriClass) {
//   if (!state || !state.dataChannel || state.dataChannel.readyState !== 'open') {
//     return;
//   }
//
//   // console.log('SEND!', message);
//   state.dataChannel.send(JSON.stringify(message));
// }

export async function handleUpdateGroupCallConnection(data: GroupCallConnectionData, isPresentation: boolean) {
  if (!state) {
    return;
  }

  const conference = isPresentation ? state.screenshareConference : state.conference;
  const connection = isPresentation ? state.screenshareConnection : state.connection;

  if (!conference || !connection || !conference.ssrcs) {
    return;
  }

  const sessionId = Date.now();
  const newConference = {
    ...conference,
    transport: data.transport,
    sessionId,
    audioExtensions: data.audio?.['rtp-hdrexts'],
    audioPayloadTypes: data.audio?.['payload-types'],
    videoExtensions: data.video?.['rtp-hdrexts'],
    videoPayloadTypes: data.video?.['payload-types'],
  } as Conference;

  state = {
    ...state,
    ...(!isPresentation ? { conference: newConference } : { screenshareConference: newConference }),
  };

  try {
    await connection.setRemoteDescription({
      type: 'answer',
      sdp: buildSdp(newConference, true, isPresentation),
    });

    // state.resolveTest();
    // state.test = true;
  } catch (e) {
    console.error(e);
  }
}

function handleTrack(e: RTCTrackEvent) {
  if (!state || !state.audioElement || !state.audioContext || !state.mediaStream) {
    return;
  }
  const ssrc = state.conference?.ssrcs?.find((l) => l.endpoint === e.track.id);
  if (!ssrc || !ssrc.userId) {
    return;
  }

  const { userId, isPresentation } = ssrc;
  const participant = state.participants?.find((p) => p.id === userId);

  const streamType = (e.track.kind === 'video' ? (isPresentation ? 'presentation' : 'video') : 'audio') as StreamType;

  e.track.onended = () => {
    delete state?.streams?.[userId][streamType];
    updateGroupCallStreams(userId);
  };

  const stream = e.streams[0];

  if (e.track.kind === 'audio') {
    const { mediaStream } = state;
    const audioContext = new (window.AudioContext)();
    const source = audioContext.createMediaStreamSource(stream);

    const gainNode = audioContext.createGain();
    gainNode.gain.value = (participant?.volume || 10000) / 10000;

    const muteNode = audioContext.createGain();
    gainNode.gain.value = 1;

    const analyser = audioContext.createAnalyser();
    analyser.minDecibels = -100;
    analyser.maxDecibels = -30;
    analyser.smoothingTimeConstant = 0.05;
    analyser.fftSize = 1024;

    source.connect(analyser).connect(muteNode).connect(gainNode).connect(audioContext.destination);

    mediaStream!.addTrack(source.mediaStream.getAudioTracks()[0]);

    // https://stackoverflow.com/questions/41784137/webrtc-doesnt-work-with-audiocontext#comment117600018_41784241
    const test = new Audio();
    test.srcObject = stream;
    // test.srcObject = source.mediaStream;
    test.muted = true;
    test.remove();

    state = {
      ...state,
      participantFunctions: {
        ...state.participantFunctions,
        [userId]: {
          ...state.participantFunctions?.[userId],
          setVolume: (volume: number) => {
            gainNode.gain.value = volume > 1 ? volume * 2 : volume;
          },
          toggleMute: (muted?: boolean) => {
            muteNode.gain.value = muted ? 0 : 1;
          },
          getCurrentAmplitude: () => {
            const array = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(array);
            return getAmplitude(array, 1.5);
          },
        },
      },
    };
  }

  state = {
    ...state,
    streams: {
      ...state.streams,
      [userId]: {
        ...state.streams?.[userId],
        [streamType]: stream,
      },
    },
  };

  updateGroupCallStreams(userId);
}

function initializeConnection(
  streams: MediaStream[],
  resolve: (payload: JoinGroupCallPayload) => void,
  isPresentation = false,
) {
  const connection = new RTCPeerConnection();

  const dataChannel = isPresentation ? undefined : createDataChannel(connection);

  streams.forEach((stream) => stream.getTracks().forEach((track) => {
    connection.addTrack(track, stream);
  }));

  if (!isPresentation) {
    connection.oniceconnectionstatechange = () => {
      const connectionState = connection.iceConnectionState;
      console.log('iceconnectionstatechange', connectionState);
      if (connectionState === 'connected' || connectionState === 'completed') {
        updateConnectionState('connected');
      } else if (connectionState === 'checking' || connectionState === 'new') {
        updateConnectionState('connecting');
      } else if (connection.iceConnectionState === 'disconnected') {
        updateConnectionState('reconnecting');
      }
    };
  }
  connection.onconnectionstatechange = () => {
    console.log('connectionstatechange', connection.connectionState);
  }
  connection.ontrack = handleTrack;
  connection.onnegotiationneeded = async () => {
    if (!state) return;

    console.log('onnegotiationneeded');

    const { myId } = state;

    if (!myId) {
      return;
    }
    const offer = await connection.createOffer({
      offerToReceiveVideo: true,
      offerToReceiveAudio: !isPresentation,
    });
    console.log('offer created');

    await connection.setLocalDescription(offer);
    console.log('local desc set');

    if (!offer.sdp) {
      return;
    }

    const sdp = parseSdp(offer);
    const audioSsrc: Ssrc | undefined = !isPresentation ? {
      userId: '',
      sourceGroups: [
        {
          sources: [sdp.ssrc || 0],
        },
      ],
      isRemoved: isPresentation,
      isMain: true,
      isVideo: false,
      isPresentation,
      endpoint: isPresentation ? '1' : '0',
      mid: isPresentation ? '1' : '0'
    } : undefined;

    const videoSsrc: Ssrc | undefined = sdp['ssrc-groups'] && {
      isPresentation,
      userId: '',
      sourceGroups: sdp['ssrc-groups'],
      isMain: true,
      isVideo: true,
      endpoint: isPresentation ? '0' : '1',
      mid: isPresentation ? '0' : '1'
    };

    const conference = isPresentation ? state.screenshareConference : state.conference;

    const ssrcs: Ssrc[] = [];
    if (isPresentation) {
      if (videoSsrc) ssrcs.push(videoSsrc);
      if (audioSsrc) ssrcs.push(audioSsrc);
    } else {
      if (audioSsrc) ssrcs.push(audioSsrc);
      if (videoSsrc) ssrcs.push(videoSsrc);
    }

    const audioStream = streams.find((l) => l.getTracks()[0].kind === 'audio');
    const videoStream = streams.find((l) => l.getTracks()[0].kind === 'video');

    state = {
      ...state,
      ...(!isPresentation ? {
        conference: {
          ...conference,
          ssrcs,
        },
      } : {
        screenshareConference: {
          ...conference,
          ssrcs,
        },
      }),
      streams: {
        ...state.streams,
        [myId]: {
          ...state.streams?.[myId],
          ...(audioStream && { audio: audioStream }),
          ...(!isPresentation && videoStream ? { video: videoStream } : { presentation: videoStream }),
        },
      },
    };

    updateGroupCallStreams(myId);

    resolve(sdp);
  };

  return { connection, dataChannel };
}

export async function startSharingScreen(): Promise<JoinGroupCallPayload | undefined> {
  if (!state) {
    return undefined;
  }

  try {
    const stream: MediaStream | undefined = await getUserStream('presentation');

    if (!stream) {
      return undefined;
    }

    stream.getTracks()[0].onended = () => {
      if (state && state.myId) {
        delete state.streams?.[state.myId].presentation;
        updateGroupCallStreams(state.myId);
        leavePresentation();
      }
    };

    return await new Promise((resolve) => {
      const { connection, dataChannel } = initializeConnection([stream], resolve, true);
      state = {
        ...state!,
        screenshareConnection: connection,
        screenshareDataChannel: dataChannel,
      };
    });
  } catch (e) {
    return undefined;
  }
}

export function joinGroupCall(
  myId: string,
  audioContext: AudioContext,
  audioElement: HTMLAudioElement,
  onUpdate: (...args: any[]) => void,
): Promise<JoinGroupCallPayload> {
  if (state) {
    throw Error('Already in call');
  }

  updateConnectionState('connecting');

  const mediaStream = new MediaStream();
  audioElement.srcObject = mediaStream;
  safePlay(audioElement);

  state = {
    onUpdate,
    participants: [],
    myId,
    speaking: {},
    silence: silence(audioContext),
    black: black({ width: 640, height: 480 }),
    // @ts-ignore
    analyserInterval: setInterval(analyzeAmplitudes, 1000),
    audioElement,
    // destination,
    audioContext,
    mediaStream,
    lastMid: DEFAULT_MID,
  };

  // Prepare microphone
  getUserStream('audio');

  return new Promise((resolve) => {
    state = {
      ...state!,
      ...initializeConnection([state!.silence!, state!.black!], resolve),
    };
  });
}
