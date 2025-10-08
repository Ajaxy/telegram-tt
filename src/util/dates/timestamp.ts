import {
  type ApiFormattedText,
  type ApiMessageEntityTimestamp,
  ApiMessageEntityTypes,
} from '../../api/types';

import { getSeconds } from './units';

const TIMESTAMP_RE = /\b(?:(\d{1,2}):)?([0-5]?\d):([0-5]\d)\b/g;

export function addTimestampEntities<T extends ApiFormattedText>(apiText: T): T {
  const resultText: Required<ApiFormattedText> & T = {
    ...apiText,
    text: apiText.text,
    entities: apiText.entities?.filter((e) => e.type !== ApiMessageEntityTypes.Timestamp) || [],
  };

  const text = resultText.text;

  for (const match of text.matchAll(TIMESTAMP_RE)) {
    const fullMatch = match[0];
    const hourStr = match[1];
    const minuteStr = match[2];
    const secondStr = match[3];
    const offset = match.index ?? 0;
    const length = fullMatch.length;

    const minutes = parseInt(minuteStr, 10);
    const seconds = parseInt(secondStr, 10);

    if (minutes > 59 || seconds > 59) {
      continue;
    }

    let totalSeconds: number;
    if (hourStr !== undefined) {
      const hours = parseInt(hourStr, 10);
      totalSeconds = getSeconds(hours, minutes, seconds);
    } else {
      totalSeconds = getSeconds(0, minutes, seconds);
    }

    let overlaps = false;
    for (const entity of resultText.entities) {
      if (offset < entity.offset + entity.length && offset + length > entity.offset) {
        overlaps = true;
        break;
      }
    }
    if (overlaps) {
      continue;
    }

    const newEntity: ApiMessageEntityTimestamp = {
      type: ApiMessageEntityTypes.Timestamp,
      offset,
      length,
      timestamp: totalSeconds,
    };

    let inserted = false;
    for (let i = 0; i < resultText.entities.length; i++) {
      if (offset < resultText.entities[i].offset) {
        resultText.entities.splice(i, 0, newEntity);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      resultText.entities.push(newEntity);
    }
  }

  return resultText;
}

export function parseTimestampDuration(input: string): number | undefined {
  input = input.trim();

  if (!input.startsWith('-') && Number.isInteger(Number(input))) {
    return parseInt(input, 10);
  }

  if (input.includes(':')) {
    const parts = input.split(':');

    if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10);
      const seconds = parseInt(parts[1], 10);

      if (
        Number.isNaN(minutes) || Number.isNaN(seconds)
        || minutes < 0 || seconds < 0 || seconds >= 60
      ) {
        return undefined;
      }
      return minutes * 60 + seconds;
    }

    if (parts.length === 3) {
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      const seconds = parseInt(parts[2], 10);

      if (
        Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)
        || hours < 0 || minutes < 0 || seconds < 0 || minutes >= 60 || seconds >= 60
      ) {
        return undefined;
      }
      return hours * 3600 + minutes * 60 + seconds;
    }

    return undefined;
  }

  const regex = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i;
  const match = input.match(regex);
  if (!match) {
    return undefined;
  }

  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const seconds = match[3] ? parseInt(match[3], 10) : 0;

  if (
    Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)
    || minutes >= 60 || seconds >= 60
  ) {
    return undefined;
  }
  return hours * 3600 + minutes * 60 + seconds;
}
