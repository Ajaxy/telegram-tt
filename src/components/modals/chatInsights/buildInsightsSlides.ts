import type { ChatInsights, ChatInsightsMedia } from '../../../types/chatInsights';
import type { IconName } from '../../../types/icons';
import type { RegularLangKey } from '../../../types/language';

export type InsightsTheme = 'blue' | 'coral' | 'violet' | 'teal' | 'night' | 'amber' | 'rose';

export type InsightsMediaItem = {
  key: keyof ChatInsightsMedia;
  icon: IconName;
  labelKey: RegularLangKey;
  count: number;
};

export type InsightsSummaryItem = {
  key: string;
  value: string;
  labelKey: RegularLangKey;
};

export type InsightsSlide = { key: string; theme: InsightsTheme } & (
  { type: 'intro' }
  | { type: 'senders' }
  | { type: 'when'; busiestHour: number; busiestWeekday: number }
  | { type: 'media'; items: InsightsMediaItem[] }
  | { type: 'emoji' }
  | { type: 'rhythm'; fastestReplier?: { peerId: string; replyTimeMedian: number } }
  | { type: 'topMessage' }
  | { type: 'summary'; items: InsightsSummaryItem[] }
);

const MEDIA_ITEMS: { key: keyof ChatInsightsMedia; icon: IconName; labelKey: RegularLangKey }[] = [
  { key: 'photos', icon: 'camera', labelKey: 'ChatInsightsPhotos' },
  { key: 'videos', icon: 'video', labelKey: 'ChatInsightsVideos' },
  { key: 'voices', icon: 'microphone', labelKey: 'ChatInsightsVoices' },
  { key: 'videoMessages', icon: 'video-outlined', labelKey: 'ChatInsightsVideoMessages' },
  { key: 'stickers', icon: 'stickers', labelKey: 'ChatInsightsStickers' },
  { key: 'gifs', icon: 'gifs', labelKey: 'ChatInsightsGifs' },
  { key: 'links', icon: 'link', labelKey: 'ChatInsightsLinks' },
  { key: 'files', icon: 'document', labelKey: 'ChatInsightsFiles' },
  { key: 'polls', icon: 'poll', labelKey: 'ChatInsightsPolls' },
];

const MAX_MEDIA_ITEMS = 6;
const MIN_STREAK_DAYS = 2;
const MIN_REPLY_SAMPLES_SENDERS = 2;

export function buildInsightsSlides(
  insights: ChatInsights,
  options: { isPrivate: boolean; currentUserId?: string },
): InsightsSlide[] {
  const slides: InsightsSlide[] = [{ key: 'intro', type: 'intro', theme: 'blue' }];

  if (insights.senders.length >= MIN_REPLY_SAMPLES_SENDERS) {
    slides.push({ key: 'senders', type: 'senders', theme: 'coral' });
  }

  slides.push({
    key: 'when',
    type: 'when',
    theme: 'violet',
    busiestHour: indexOfMax(insights.byHour),
    busiestWeekday: indexOfMax(insights.byWeekday),
  });

  const mediaItems = MEDIA_ITEMS
    .map((item) => ({ ...item, count: insights.media[item.key] }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_MEDIA_ITEMS);
  if (mediaItems.length) {
    slides.push({
      key: 'media', type: 'media', theme: 'teal', items: mediaItems,
    });
  }

  if (insights.topEmoji.length) {
    slides.push({ key: 'emoji', type: 'emoji', theme: 'amber' });
  }

  const fastestReplier = insights.senders
    .filter((sender) => sender.replyTimeMedian !== undefined)
    .sort((a, b) => a.replyTimeMedian! - b.replyTimeMedian!)[0];
  if (insights.longestStreakDays >= MIN_STREAK_DAYS || fastestReplier) {
    slides.push({
      key: 'rhythm',
      type: 'rhythm',
      theme: 'night',
      fastestReplier: fastestReplier
        ? { peerId: fastestReplier.peerId, replyTimeMedian: fastestReplier.replyTimeMedian! }
        : undefined,
    });
  }

  if (insights.topMessage) {
    slides.push({ key: 'topMessage', type: 'topMessage', theme: 'rose' });
  }

  const ownMessages = options.currentUserId
    ? insights.senders.find((sender) => sender.peerId === options.currentUserId)?.messageCount
    : undefined;
  const summaryItems: InsightsSummaryItem[] = [
    { key: 'messages', value: String(insights.totalMessages), labelKey: 'ChatInsightsSummaryMessages' },
    { key: 'days', value: String(insights.activeDays), labelKey: 'ChatInsightsSummaryDays' },
  ];
  if (options.isPrivate && ownMessages !== undefined) {
    summaryItems.push({
      key: 'share',
      value: `${Math.round((ownMessages / insights.totalMessages) * 100)}%`,
      labelKey: 'ChatInsightsSummaryShare',
    });
  }
  if (insights.topEmoji[0]) {
    summaryItems.push({ key: 'emoji', value: insights.topEmoji[0].emoji, labelKey: 'ChatInsightsSummaryEmoji' });
  }
  slides.push({
    key: 'summary', type: 'summary', theme: 'blue', items: summaryItems,
  });

  return slides;
}

function indexOfMax(values: number[]) {
  let index = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[index]) index = i;
  }
  return index;
}
