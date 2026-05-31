import type {
  ApiAiComposeToneDefault, ApiAiComposeToneType, ApiInputAiComposeTone,
} from '../api/types';

function isDefaultTone(tone: ApiAiComposeToneType): tone is ApiAiComposeToneDefault {
  return 'tone' in tone;
}

export function getInputTone(tone: ApiAiComposeToneType): ApiInputAiComposeTone {
  if (isDefaultTone(tone)) {
    return { type: 'default', tone: tone.tone };
  }
  return { type: 'id', id: tone.id, accessHash: tone.accessHash };
}

export function getToneCacheKey(tone: ApiInputAiComposeTone): string {
  switch (tone.type) {
    case 'default': return `d:${tone.tone}`;
    case 'id': return `i:${tone.id}:${tone.accessHash}`;
    case 'slug': return `s:${tone.slug}`;
  }
}

export function compareAiTones(
  a?: ApiInputAiComposeTone,
  b?: ApiInputAiComposeTone,
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return getToneCacheKey(a) === getToneCacheKey(b);
}
