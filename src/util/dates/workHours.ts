import type { ApiBusinessTimetableSegment } from '../../api/types';

const DAY_MINUTES = 1440;
const WEEK_MINUTES = 10080;

/**
 * @returns Monday 00:00 of the current week for the local timezone
 */
export function getWeekStart(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(now.setDate(diff)).getTime();
}

/**
 * @returns UTC offset in seconds
 */
export function getUtcOffset() {
  return new Date().getTimezoneOffset() * -60;
}

export function shiftTimeRanges(ranges: ApiBusinessTimetableSegment[], shift: number): ApiBusinessTimetableSegment[] {
  if (shift === 0) return ranges;

  const shiftedRanges: ApiBusinessTimetableSegment[] = [];

  for (const range of ranges) {
    let start = (range.startMinute + shift) % WEEK_MINUTES;
    let end = (range.endMinute + shift) % WEEK_MINUTES;

    if (start < 0) start += WEEK_MINUTES;
    if (end <= 0) end += WEEK_MINUTES;

    if (start > end) {
      shiftedRanges.push({ startMinute: start, endMinute: WEEK_MINUTES - 1 });
      shiftedRanges.push({ startMinute: 0, endMinute: end });
    } else {
      shiftedRanges.push({ startMinute: start, endMinute: end });
    }
  }

  shiftedRanges.sort((a, b) => a.startMinute - b.startMinute);

  // Combine overlapping ranges
  return shiftedRanges.reduce<ApiBusinessTimetableSegment[]>((acc, range) => {
    const last = acc[acc.length - 1];
    if (last && last.endMinute >= range.startMinute) {
      last.endMinute = Math.max(last.endMinute, range.endMinute);
    } else {
      acc.push(range);
    }
    return acc;
  }, []);
}

export function splitDays(ranges: ApiBusinessTimetableSegment[]): Record<number, ApiBusinessTimetableSegment[]> {
  const days: Record<number, ApiBusinessTimetableSegment[]> = {};

  for (const range of ranges) {
    const start = range.startMinute;
    const end = range.endMinute;

    const dayStart = Math.floor(start / DAY_MINUTES);
    const dayEnd = Math.floor((end - 1) / DAY_MINUTES); // 00:00 is counted as same day

    for (let day = dayStart; day <= dayEnd; day++) {
      if (!days[day]) {
        days[day] = [];
      }

      days[day].push({
        startMinute: Math.max(0, start - day * DAY_MINUTES),
        endMinute: Math.min(DAY_MINUTES, end - day * DAY_MINUTES),
      });
    }
  }

  return days;
}
