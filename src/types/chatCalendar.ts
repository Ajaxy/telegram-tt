export type ChatCalendarDay = {
  count: number;
  minMsgId: number;
  // Message with a photo or video for the day thumbnail
  mediaMessageId?: number;
};

export type ChatCalendar = {
  chatId: string;
  isLoading: boolean;
  // Keyed by local day as `YYYY-M-D`
  days: Record<string, ChatCalendarDay>;
  maxDayCount: number;
  // Oldest day covered so far, as timestamp in seconds
  loadedFromDate?: number;
  isComplete?: boolean;
};
