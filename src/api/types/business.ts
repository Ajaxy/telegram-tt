import type { ApiGeoPoint, ApiSticker } from './messages';

export interface ApiBusinessLocation {
  geo?: ApiGeoPoint;
  address: string;
}

export interface ApiBusinessTimetableSegment {
  startMinute: number;
  endMinute: number;
}

export interface ApiBusinessWorkHours {
  timezoneId: string;
  workHours: ApiBusinessTimetableSegment[];
}

export interface ApiBusinessIntro {
  title: string;
  description: string;
  sticker?: ApiSticker;
}
