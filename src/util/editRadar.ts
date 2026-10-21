import type { ApiMessage } from '../api/types';
import type { LangFn } from './localization';

// An edit counts as "late" when it happened at least this long after the message was sent.
// Typo fixes right after sending stay quiet.
export const LATE_EDIT_THRESHOLD = 24 * 60 * 60;
// The radar banner only reports late edits that happened recently.
export const EDIT_RADAR_LOOKBACK = 7 * 24 * 60 * 60;

const SEEN_STORAGE_KEY = 'tt-edit-radar-seen';
const SEEN_LIMIT = 500;

const HOUR = 60 * 60;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

let seenCache: Set<string> | undefined;

export function getEditDelay(message: Pick<ApiMessage, 'date' | 'editDate' | 'isEdited'>) {
  if (!message.isEdited || !message.editDate) return undefined;

  return message.editDate - message.date;
}

export function isLateEdit(message: Pick<ApiMessage, 'date' | 'editDate' | 'isEdited'>) {
  const delay = getEditDelay(message);

  return delay !== undefined && delay >= LATE_EDIT_THRESHOLD;
}

export function formatEditDelay(lang: LangFn, delay: number) {
  if (delay >= YEAR) {
    const count = Math.floor(delay / YEAR);
    return lang('EditRadarYears', { count }, { pluralValue: count });
  }

  if (delay >= MONTH) {
    const count = Math.floor(delay / MONTH);
    return lang('EditRadarMonths', { count }, { pluralValue: count });
  }

  if (delay >= DAY) {
    const count = Math.floor(delay / DAY);
    return lang('EditRadarDays', { count }, { pluralValue: count });
  }

  const count = Math.max(1, Math.floor(delay / HOUR));
  return lang('EditRadarHours', { count }, { pluralValue: count });
}

function buildSeenKey(chatId: string, message: Pick<ApiMessage, 'id' | 'editDate'>) {
  return `${chatId}:${message.id}:${message.editDate}`;
}

function readSeen() {
  if (seenCache) return seenCache;

  try {
    const raw = localStorage.getItem(SEEN_STORAGE_KEY);
    seenCache = new Set(raw ? JSON.parse(raw) as string[] : []);
  } catch {
    seenCache = new Set();
  }

  return seenCache;
}

export function isEditRadarSeen(chatId: string, message: Pick<ApiMessage, 'id' | 'editDate'>) {
  return readSeen().has(buildSeenKey(chatId, message));
}

export function markEditRadarSeen(chatId: string, messages: Pick<ApiMessage, 'id' | 'editDate'>[]) {
  const seen = readSeen();
  messages.forEach((message) => seen.add(buildSeenKey(chatId, message)));

  try {
    localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(Array.from(seen).slice(-SEEN_LIMIT)));
  } catch {
    // Storage may be unavailable in private mode; the radar still works for this session
  }
}

export function getUnseenLateEdits(
  chatId: string, messagesById: Record<number, ApiMessage> | undefined, now: number,
) {
  if (!messagesById) return [];

  return Object.values(messagesById)
    .filter((message) => (
      isLateEdit(message)
      && now - message.editDate! <= EDIT_RADAR_LOOKBACK
      && !isEditRadarSeen(chatId, message)
    ))
    .sort((a, b) => b.editDate! - a.editDate!);
}
