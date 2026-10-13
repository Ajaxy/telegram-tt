export type ChatInsightsSender = {
  peerId: string;
  messageCount: number;
  // Median reply time in seconds, when the sender answered the other side
  replyTimeMedian?: number;
};

export type ChatInsightsMedia = {
  photos: number;
  videos: number;
  voices: number;
  videoMessages: number;
  stickers: number;
  gifs: number;
  files: number;
  links: number;
  polls: number;
};

export type ChatInsightsEmoji = {
  emoji: string;
  count: number;
};

export type ChatInsightsTopMessage = {
  messageId: number;
  senderId?: string;
  text?: string;
  reactionCount: number;
};

export type ChatInsights = {
  chatId: string;
  totalMessages: number;
  isComplete: boolean;
  firstMessageDate: number;
  lastMessageDate: number;
  activeDays: number;
  longestStreakDays: number;
  senders: ChatInsightsSender[];
  byHour: number[];
  byWeekday: number[];
  media: ChatInsightsMedia;
  topEmoji: ChatInsightsEmoji[];
  topMessage?: ChatInsightsTopMessage;
  nightMessages: number;
  totalCharacters: number;
};
