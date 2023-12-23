import type {
  Candidate, GroupCallTransport, PayloadType, RTPExtension, SsrcGroup,
} from './types';
import { fromTelegramSource } from './utils';

export type Conference = {
  sessionId: number;
  audioExtensions: RTPExtension[];
  videoExtensions: RTPExtension[];
  audioPayloadTypes: PayloadType[];
  videoPayloadTypes: PayloadType[];
  ssrcs: Ssrc[];
  transport: GroupCallTransport;
};

export type Ssrc = {
  userId: string;
  endpoint: string;
  mid: string;
  isMain: boolean;
  isRemoved?: boolean;
  isVideo: boolean;
  isPresentation?: boolean;
  sourceGroups: SsrcGroup[];
};

export default (conference: Conference, isAnswer = false, isPresentation = false, isP2p = false) => {
  const lines: string[] = [];

  const add = (value: string) => {
    lines.push(value);
  };

  const {
    sessionId,
    ssrcs,
    audioExtensions,
    videoExtensions,
    audioPayloadTypes,
    videoPayloadTypes,
    transport: {
      ufrag,
      pwd,
      fingerprints,
      candidates,
    },
  } = conference;

  // Header
  add('v=0'); // version
  add(`o=- ${sessionId} 2 IN IP4 0.0.0.0`); // sessionId, 2=sessionVersion
  add('s=-'); // name of the session
  add('t=0 0'); // time when session is valid
  add('a=ice-options:trickle');
  add('a=msid-semantic:WMS *');
  add(`a=group:BUNDLE ${ssrcs.map((ssrc) => ssrc.mid).join(' ')}${isPresentation ? '' : ` ${isP2p ? '3' : '2'}`}`);
  // ice-lite: is a minimal version of the ICE specification, intended only for servers running on a public IP address
  if (!isP2p) add('a=ice-lite');

  const addCandidate = (c: Candidate) => {
    if (c.sdpString) {
      add(`a=${c.sdpString}`);
    } else {
      let str = '';
      str += 'a=candidate:';
      str += `${c.foundation} ${c.component} ${c.protocol} ${c.priority} ${c.ip} ${c.port} typ ${c.type}`;
      if ('rel-addr' in c) {
        str += ` raddr ${c['rel-addr']} rport ${c['rel-port']}`;
      }
      str += ` generation ${c.generation}`;
      add(str);
    }
  };

  const addTransport = () => {
    add(`a=ice-ufrag:${ufrag}`);
    add(`a=ice-pwd:${pwd}`);
    fingerprints.forEach((fingerprint) => {
      add(`a=fingerprint:${fingerprint.hash} ${fingerprint.fingerprint}`);
      add(`a=setup:${isP2p ? (fingerprint.setup) : 'passive'}`);
    });

    candidates.forEach(addCandidate);
  };

  const addPayloadType = (payloadType: PayloadType) => {
    const {
      channels, id, name, clockrate, parameters,
    } = payloadType;

    const channelsString = channels ? `/${channels}` : '';
    add(`a=rtpmap:${id} ${name}/${clockrate}${channelsString}`);

    if (parameters) {
      const parametersString = Object.keys(parameters).map((key) => {
        return `${key}=${parameters![key]};`;
      }).join(' ');

      add(`a=fmtp:${id} ${parametersString}`);
    }

    payloadType['rtcp-fbs']?.forEach((fbParam) => {
      add(`a=rtcp-fb:${id} ${fbParam.type}${fbParam.subtype ? ` ${fbParam.subtype}` : ''}`);
    });
  };

  const addSsrcEntry = (entry: Ssrc) => {
    const payloadTypes = entry.isVideo ? videoPayloadTypes : audioPayloadTypes;

    const type = entry.isVideo ? 'video' : 'audio';
    add(`m=${type} ${entry.isMain ? 1 : 0} RTP/SAVPF ${payloadTypes.map((l) => l.id).join(' ')}`);
    add('c=IN IP4 0.0.0.0');
    add('b=AS:1300'); // 1300000 / 1000
    add(`a=mid:${entry.mid}`);
    add('a=rtcp-mux');
    payloadTypes.forEach(addPayloadType);

    add('a=rtcp:1 IN IP4 0.0.0.0');
    if (entry.isVideo) {
      add('a=rtcp-rsize');
    }

    (entry.isVideo ? videoExtensions : audioExtensions).forEach(({ id, uri }) => {
      add(`a=extmap:${id} ${uri}`);
    });

    if (entry.isRemoved) {
      add('a=inactive');
      return;
    }

    addTransport();

    if (isP2p) {
      add('a=sendrecv');
      add('a=bundle-only');
    } else {
      if (isAnswer) {
        add('a=recvonly');
        return;
      }
      if (entry.isMain) {
        add('a=sendrecv');
      } else {
        add('a=sendonly');
        add('a=bundle-only');
      }
    }

    entry.sourceGroups.forEach((sourceGroup) => {
      if (sourceGroup.semantics) {
        add(`a=ssrc-group:${sourceGroup.semantics} ${sourceGroup.sources.map(fromTelegramSource).join(' ')}`);
      }
      sourceGroup.sources.forEach((ssrcTelegram) => {
        const ssrc = fromTelegramSource(ssrcTelegram);
        add(`a=ssrc:${ssrc} cname:${entry.endpoint}`);
        add(`a=ssrc:${ssrc} msid:${entry.endpoint} ${entry.endpoint}`);
        add(`a=ssrc:${ssrc} mslabel:${entry.endpoint}`);
        add(`a=ssrc:${ssrc} label:${entry.endpoint}`);
      });
    });
  };

  if (!isP2p) {
    ssrcs.filter((ssrc) => ssrc.mid === '0' || ssrc.mid === '1').map(addSsrcEntry);
  } else {
    ssrcs.filter(addSsrcEntry);
  }

  if (!isPresentation) {
    add('m=application 1 UDP/DTLS/SCTP webrtc-datachannel');
    add('c=IN IP4 0.0.0.0');
    addTransport();
    add('a=ice-options:trickle');
    add(`a=mid:${isP2p ? '3' : (isPresentation ? '1' : '2')}`);
    add('a=sctp-port:5000');
    add('a=max-message-size:262144');
  }

  if (!isP2p) {
    ssrcs.filter((ssrc) => ssrc.mid !== '0' && ssrc.mid !== '1').map(addSsrcEntry);
  }

  return `${lines.join('\n')}\n`;
};
