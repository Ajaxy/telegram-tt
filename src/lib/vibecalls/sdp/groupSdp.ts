import type { JoinGroupCallPayload, P2pParsedSdp, SsrcGroup } from '../types';
import type { SdpSection } from './common';

import { toTelegramSource } from '../utils';
import {
  findSdpLineValue,
  parseExtmaps as parseSectionExtmaps,
  parsePayloadTypes as parseSectionPayloadTypes,
  parseSdpSections,
} from './common';

// Returns undefined when the SDP is missing or malformed.
export default (
  sessionDescription: RTCSessionDescriptionInit,
  isP2p = false,
): JoinGroupCallPayload | P2pParsedSdp | undefined => {
  if (!sessionDescription.sdp) {
    return undefined;
  }

  const sdpSections = parseSdpSections(sessionDescription.sdp);
  const sections = sdpSections.reduce((acc: Record<string, SdpSection>, section) => {
    const name = section.kind === 'session' ? 'header' : section.kind;
    acc[acc.hasOwnProperty(name) && name === 'video' ? 'screencast' : name] = section;
    return acc;
  }, {});

  const lookup = (prefix: string, sectionName?: string) => {
    return findSdpLineValue(Object.values(sections), prefix, sectionName ? sections[sectionName] : undefined);
  };

  const lookupAll = (prefix: string, sectionName: string) => {
    return sections[sectionName]?.lines
      .filter((line) => line.startsWith(prefix))
      .map((line) => line.slice(prefix.length)) || [];
  };

  const parseExtmaps = (sectionName: string) => parseSectionExtmaps(sections[sectionName]);
  const parsePayloadTypes = (sectionName: string) => parseSectionPayloadTypes(sections[sectionName]);

  const rawSource = lookup('a=ssrc:', 'audio');
  const sourceAudio = rawSource && Number(rawSource.split(' ')[0]);

  const rawSourceVideo = lookupAll('a=ssrc-group:', 'video').map((line) => line.split(' '));
  const rawSourceScreencast = lookupAll('a=ssrc-group:', 'screencast').map((line) => line.split(' '));

  if (!rawSourceVideo.length) {
    return undefined;
  }

  const [hash, fingerprint] = lookup('a=fingerprint:')?.split(' ') || [];

  const setup = lookup('a=setup:');
  if (!hash || !fingerprint) {
    return undefined;
  }

  const ufrag = lookup('a=ice-ufrag:');
  const pwd = lookup('a=ice-pwd:');

  if (!ufrag || !pwd) {
    return undefined;
  }

  const payload: JoinGroupCallPayload = {
    fingerprints: [
      {
        fingerprint,
        hash,
        setup: setup === 'active' || setup === 'passive' ? setup : 'passive',
      },
    ],
    pwd,
    ufrag,
  };

  if (sourceAudio) {
    payload.ssrc = toTelegramSource(sourceAudio);
  }

  const ssrcGroups = parseSourceGroups(rawSourceVideo);
  if (!ssrcGroups.length) {
    return undefined;
  }

  if (isP2p && rawSourceScreencast.length) {
    ssrcGroups.push(...parseSourceGroups(rawSourceScreencast));
  }

  payload['ssrc-groups'] = ssrcGroups;

  if (!isP2p) {
    return payload;
  }

  const hasScreencast = Boolean(sections.screencast);

  try {
    return {
      ...payload,
      audioExtmap: parseExtmaps('audio'),
      videoExtmap: parseExtmaps('video'),
      screencastExtmap: hasScreencast ? parseExtmaps('screencast') : [],
      audioPayloadTypes: parsePayloadTypes('audio'),
      videoPayloadTypes: parsePayloadTypes('video'),
      screencastPayloadTypes: hasScreencast ? parsePayloadTypes('screencast') : [],
    };
  } catch {
    return undefined;
  }
};

function parseSourceGroups(rawGroups: string[][]): SsrcGroup[] {
  const result: SsrcGroup[] = [];
  rawGroups.forEach(([semantics, ...sources]) => {
    if (!semantics || !sources.length) {
      return;
    }

    result.push({
      semantics,
      sources: sources.map(Number).map(toTelegramSource),
    });
  });

  return result;
}
