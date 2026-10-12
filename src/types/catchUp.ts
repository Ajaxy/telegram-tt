export type CatchUpSender = {
  peerId: string;
  messageCount: number;
};

export type CatchUpMessageRef = {
  messageId: number;
  senderId?: string;
  text?: string;
  date: number;
};

export type CatchUpLink = {
  messageId: number;
  url: string;
  domain: string;
  title?: string;
};

export type CatchUpMedia = {
  photos: number;
  videos: number;
  voices: number;
  files: number;
  stickers: number;
  polls: number;
  firstMessageIdByKind: Partial<Record<'photos' | 'videos' | 'voices' | 'files' | 'stickers' | 'polls', number>>;
};

export type CatchUpSummary = {
  chatId: string;
  totalMessages: number;
  isComplete: boolean;
  firstUnreadId: number;
  firstDate: number;
  lastDate: number;
  senders: CatchUpSender[];
  media: CatchUpMedia;
  mentions: CatchUpMessageRef[];
  replies: CatchUpMessageRef[];
  questions: CatchUpMessageRef[];
  links: CatchUpLink[];
  pinned: CatchUpMessageRef[];
};
