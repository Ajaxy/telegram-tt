import type { P2PPayloadType } from '../phone/signalingMessages';
import type {
  Fingerprint, RTPExtension,
} from '../types';

export type SdpSection = {
  kind: string;
  lines: string[];
  mid?: string;
};

type SdpSummarySection = {
  kind: string;
  mid?: string;
  port: number;
  direction?: string;
  payloads: string[];
  ssrcs: number[];
};

export function parseSdpSections(sdp: string) {
  return sdp
    .split(/\r?\nm=/)
    .map((section, index) => index === 0 ? section : `m=${section}`)
    .map((section): SdpSection => {
      const lines = section.split(/\r?\n/).filter(Boolean);
      const kind = lines[0]?.match(/^m=([^\s]+)/)?.[1] || 'session';
      const mid = lines.find((line) => line.startsWith('a=mid:'))?.slice('a=mid:'.length);
      return { kind, lines, mid };
    });
}

export function parseBundleMids(sdp: string) {
  const line = sdp.split(/\r?\n/).find((item) => item.startsWith('a=group:BUNDLE '));
  return line?.slice('a=group:BUNDLE '.length).split(' ').filter(Boolean);
}

export function findSdpLineValue(sections: SdpSection[], prefix: string, section?: SdpSection) {
  if (section) {
    const sectionLine = section.lines.find((line) => line.startsWith(prefix));
    if (sectionLine) {
      return sectionLine.slice(prefix.length);
    }

    for (const item of sections) {
      if (item.kind !== 'session') {
        continue;
      }

      const sessionLine = item.lines.find((line) => line.startsWith(prefix));
      if (sessionLine) {
        return sessionLine.slice(prefix.length);
      }
    }

    return undefined;
  }

  for (const item of sections) {
    const value = item.lines.find((line) => line.startsWith(prefix))?.slice(prefix.length);
    if (value) {
      return value;
    }
  }

  return undefined;
}

export function getSdpDirection(section: SdpSection) {
  return section.lines.find((line) => {
    return line === 'a=sendrecv' || line === 'a=sendonly' || line === 'a=recvonly' || line === 'a=inactive';
  })?.slice(2);
}

export function getSdpPort(section: SdpSection) {
  return Number(section.lines[0]?.split(' ')[1] || 0);
}

export function parseFingerprints(sections: SdpSection[]): Fingerprint[] {
  const values = new Map<string, Fingerprint>();

  sections.forEach((section) => {
    const fingerprint = findSdpLineValue(sections, 'a=fingerprint:', section);
    if (!fingerprint) {
      return;
    }

    const [hash, value] = fingerprint.split(' ');
    const setup = findSdpLineValue(sections, 'a=setup:', section) || 'actpass';
    if (!hash || !value) {
      return;
    }

    values.set(`${hash}:${value}:${setup}`, {
      hash,
      setup,
      fingerprint: value,
    });
  });

  return Array.from(values.values());
}

export function parseSsrcGroups(section: SdpSection) {
  return section.lines.filter((line) => line.startsWith('a=ssrc-group:')).map((line) => {
    const [, value] = line.split(':');
    const [semantics, ...ssrcs] = value.split(' ');
    return {
      semantics,
      ssrcs: ssrcs.map(Number),
    };
  });
}

export function parseSsrcs(section: SdpSection, shouldIncludeGroups = false) {
  const values = new Set<number>();

  section.lines.forEach((line) => {
    if (shouldIncludeGroups && line.startsWith('a=ssrc-group:')) {
      line.match(/\d+/g)?.forEach((value) => {
        values.add(Number(value));
      });
      return;
    }

    const match = line.match(/^a=ssrc:(\d+)/);
    if (!match?.[1]) {
      return;
    }

    values.add(Number(match[1]));
  });

  return Array.from(values);
}

export function parseExtmaps(section: SdpSection): RTPExtension[] {
  return section.lines.filter((line) => line.startsWith('a=extmap:')).map((line) => {
    const [, rawId, uri] = line.match(/^a=extmap:(\d+)(?:\/[^\s]+)?\s(.+)$/) || [];
    if (!rawId || !uri) {
      throw Error('Failed parsing SDP RTP extension');
    }

    return {
      id: Number(rawId),
      uri,
    };
  });
}

export function parsePayloadTypes(section: SdpSection): P2PPayloadType[] {
  const payloadTypes: P2PPayloadType[] = section.lines.filter((line) => line.startsWith('a=rtpmap:')).map((line) => {
    const [, rawId, name, rawClockrate, rawChannels] = line.match(/^a=rtpmap:(\d+)\s([^/]+)\/(\d+)(?:\/(\d+))?/) || [];
    if (!rawId || !name || !rawClockrate) {
      throw Error('Failed parsing SDP payload type');
    }

    return {
      id: Number(rawId),
      name,
      clockrate: Number(rawClockrate),
      channels: rawChannels ? Number(rawChannels) : 0,
    };
  });

  payloadTypes.forEach((payloadType) => {
    const parameters = parsePayloadParameters(section, payloadType.id);
    const feedbackTypes = parseFeedbackTypes(section, payloadType.id);

    if (Object.keys(parameters).length) {
      payloadType.parameters = parameters;
    }
    if (feedbackTypes.length) {
      payloadType.feedbackTypes = feedbackTypes;
    }
  });

  return payloadTypes;
}

export function summarizeSdp(sdp: string, shouldIncludeSsrcGroups = false) {
  return parseSdpSections(sdp).filter((section) => section.kind !== 'session').map((section): SdpSummarySection => {
    const mLine = section.lines[0] || '';
    const parts = mLine.split(' ');

    return {
      kind: section.kind,
      mid: section.mid,
      port: getSdpPort(section),
      direction: getSdpDirection(section),
      payloads: parts.slice(3),
      ssrcs: parseSsrcs(section, shouldIncludeSsrcGroups),
    };
  });
}

function parsePayloadParameters(section: SdpSection, payloadId: number) {
  const parameters: Record<string, string> = {};
  const line = section.lines.find((item) => item.startsWith(`a=fmtp:${payloadId} `));
  const rawParameters = line?.slice(`a=fmtp:${payloadId} `.length);
  if (!rawParameters) {
    return parameters;
  }

  rawParameters.split(';').forEach((item) => {
    const trimmed = item.trim();
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex);
    const value = trimmed.slice(separatorIndex + 1);
    if (key && value) {
      parameters[key] = value;
    }
  });

  return parameters;
}

function parseFeedbackTypes(section: SdpSection, payloadId: number): NonNullable<P2PPayloadType['feedbackTypes']> {
  return section.lines.filter((line) => line.startsWith(`a=rtcp-fb:${payloadId} `)).map((line) => {
    const value = line.slice(`a=rtcp-fb:${payloadId} `.length);
    const [type, subtype] = value.split(' ');
    return {
      type,
      subtype: subtype || '',
    };
  });
}
