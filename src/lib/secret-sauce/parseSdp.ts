import { toTelegramSource } from './utils';
import type { JoinGroupCallPayload, SsrcGroup } from './types';

export default (sessionDescription: RTCSessionDescriptionInit, isP2p = false): JoinGroupCallPayload => {
  if (!sessionDescription || !sessionDescription.sdp) {
    throw Error('Failed parsing SDP: session description is null');
  }

  const sections = sessionDescription
    .sdp
    .split('\r\nm=')
    .map((s, i) => (i === 0 ? s : `m=${s}`))
    .reduce((acc: Record<string, string[]>, el) => {
      const name = el.match(/^m=(.+?)\s/)?.[1] || 'header';
      acc[acc.hasOwnProperty(name) && name === 'video' ? 'screencast' : name] = el.split('\r\n').filter(Boolean);
      return acc;
    }, {});

  const lookup = (prefix: string, sectionName?: string) => {
    if (!sectionName) {
      return Object.values(sections).map((section) => {
        return section.find((line) => line.startsWith(prefix))?.substr(prefix.length);
      }).filter(Boolean)[0];
    } else {
      return sections[sectionName]?.find((line) => line.startsWith(prefix))?.substr(prefix.length);
    }
  };

  const parseExtmaps = (sectionName: string) => {
    return sections[sectionName].filter((l) => l.startsWith('a=extmap')).map((l) => {
      const [, id, uri] = l.match(/extmap:(\d+)(?:\/.+)?\s(.+)/)!;
      return { id: Number(id), uri };
    });
  };

  const parsePayloadTypes = (sectionName: string) => {
    const payloads = sections[sectionName].filter((l) => l.startsWith('a=rtpmap')).map((l) => {
      const [, id, data] = l.match(/:(\d+)\s(.+)/) || [];
      const [name, clockrate, channels] = data.split('/');
      return {
        id: Number(id), name, clockrate: Number(clockrate), ...(channels && { channels: Number(channels) }),
      };
    });

    const fbParams = sections[sectionName].filter((l) => l.startsWith('a=rtcp-fb')).map((l) => {
      const [, id, data] = l.match(/:(\d+)\s(.+)/) || [];
      const [type, subtype] = data.split(' ');
      return { id: Number(id), type, subtype: subtype || '' };
    });

    const parameters = sections[sectionName].filter((l) => l.startsWith('a=fmtp')).map((l) => {
      const [, id, data] = l.match(/:(\d+)\s(.+)/) || [];
      const d = data?.split(';').reduce((acc: Record<string, string>, q) => {
        const [name, value] = q.split('=');
        acc[name] = value;
        return acc;
      }, {});
      if (!d || Object.values(d).some((z) => !z)) return undefined;
      return { id: Number(id), data: d };
    }).filter(Boolean);

    return payloads.map((payload) => {
      const p = parameters.filter((l) => l!.id === payload.id).map((q) => q!.data).reduce((acc, el) => {
        return Object.assign(acc, el);
      }, {});
      const f = fbParams.filter((l) => l.id === payload.id).map((l) => {
        return {
          type: l.type,
          subtype: l.subtype,
        };
      });

      return {
        ...payload,
        ...(Object.keys(p).length > 0 && { parameters: p }),
        ...(f.length > 0 && { feedbackTypes: f }),
      };
    });
  };

  const rawSource = lookup('a=ssrc:', 'audio');
  const sourceAudio = rawSource && Number(rawSource.split(' ')[0]);

  // TODO multiple source groups
  const rawSourceVideo = lookup('a=ssrc-group:', 'video')?.split(' ') || undefined;
  const rawSourceScreencast = lookup('a=ssrc-group:', 'screencast')?.split(' ') || undefined;

  if (!rawSourceVideo) {
    throw Error('Failed parsing SDP: no video ssrc');
  }

  const [hash, fingerprint] = lookup('a=fingerprint:')?.split(' ') || [];

  const setup = lookup('a=setup:');
  if (!hash || !fingerprint) {
    throw Error('Failed parsing SDP: no fingerprint');
  }

  console.log(sections);

  const ufrag = lookup('a=ice-ufrag:');
  const pwd = lookup('a=ice-pwd:');

  if (!ufrag || !pwd) {
    throw Error('Failed parsing SDP: no ICE ufrag or pwd');
  }

  return {
    fingerprints: [
      {
        fingerprint,
        hash,
        setup: isP2p ? setup! : 'active',
      },
    ],
    pwd,
    ufrag,
    ...(sourceAudio && { ssrc: toTelegramSource(sourceAudio) }),
    ...(rawSourceVideo && {
      'ssrc-groups': [
        {
          semantics: rawSourceVideo[0],
          sources: rawSourceVideo.slice(1, rawSourceVideo.length).map(Number).map(toTelegramSource),
        },
        (isP2p && rawSourceScreencast && {
          semantics: rawSourceScreencast[0],
          sources: rawSourceScreencast.slice(1, rawSourceScreencast.length).map(Number).map(toTelegramSource),
        }),
      ].filter(Boolean) as SsrcGroup[],
    }),
    ...(isP2p && {
      audioExtmap: parseExtmaps('audio'),
      videoExtmap: parseExtmaps('video'),
      screencastExtmap: parseExtmaps('screencast'),
      audioPayloadTypes: parsePayloadTypes('audio'),
      videoPayloadTypes: parsePayloadTypes('video'),
      screencastPayloadTypes: parsePayloadTypes('screencast'),
    }),
  };
};
