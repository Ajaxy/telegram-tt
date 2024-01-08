import type { ApiChat } from './chats';

export interface ApiChannelStatistics {
  growthGraph?: StatisticsGraph | string;
  followersGraph?: StatisticsGraph | string;
  muteGraph?: StatisticsGraph | string;
  topHoursGraph?: StatisticsGraph | string;
  reactionsByEmotionGraph?: StatisticsGraph | string;
  storyInteractionsGraph?: StatisticsGraph | string;
  storyReactionsByEmotionGraph?: StatisticsGraph | string;
  interactionsGraph: StatisticsGraph | string;
  viewsBySourceGraph: StatisticsGraph | string;
  newFollowersBySourceGraph: StatisticsGraph | string;
  languagesGraph: StatisticsGraph | string;
  followers: StatisticsOverviewItem;
  viewsPerPost: StatisticsOverviewItem;
  sharesPerPost: StatisticsOverviewItem;
  enabledNotifications: StatisticsOverviewPercentage;
  reactionsPerPost: StatisticsOverviewItem;
  viewsPerStory: StatisticsOverviewItem;
  sharesPerStory: StatisticsOverviewItem;
  reactionsPerStory: StatisticsOverviewItem;
  recentPosts: Array<StatisticsMessageInteractionCounter | StatisticsStoryInteractionCounter>;
}

export interface ApiGroupStatistics {
  growthGraph?: StatisticsGraph | string;
  membersGraph?: StatisticsGraph | string;
  topHoursGraph?: StatisticsGraph | string;
  languagesGraph: StatisticsGraph | string;
  messagesGraph: StatisticsGraph | string;
  actionsGraph: StatisticsGraph | string;
  period: StatisticsOverviewPeriod;
  members: StatisticsOverviewItem;
  viewers: StatisticsOverviewItem;
  messages: StatisticsOverviewItem;
  posters: StatisticsOverviewItem;
}

export interface ApiPostStatistics {
  viewsGraph?: StatisticsGraph | string;
  reactionsGraph?: StatisticsGraph | string;
  forwardsCount?: number;
  viewsCount?: number;
  reactionsCount?: number;
  publicForwards?: number;
  publicForwardsData?: (ApiMessagePublicForward | ApiStoryPublicForward)[];

  nextOffset?: string;
}

export interface ApiBoostStatistics {
  level: number;
  boosts: number;
  premiumSubscribers: StatisticsOverviewPercentage;
  remainingBoosts: number;
}

export interface ApiMessagePublicForward {
  messageId: number;
  views?: number;
  title?: string;
  chat: ApiChat;
}

export interface ApiStoryPublicForward {
  peerId: string;
  storyId: number;
  viewsCount?: number;
  reactionsCount?: number;
}

export interface StatisticsGraph {
  type: string;
  zoomToken?: string;
  labelFormatter: string;
  tooltipFormatter: string;
  labels: Array<string | number>;
  isStacked: boolean;
  isPercentage?: boolean;
  hideCaption: boolean;
  hasSecondYAxis: boolean;
  minimapRange: {
    begin: number;
    end: number;
  };
  labelFromIndex: number;
  labelToIndex: number;
  datasets: {
    name: string;
    color: string;
    values: number[];
  };
}

export interface StatisticsOverviewItem {
  current?: number;
  change?: number;
  percentage: string;
}

export interface StatisticsOverviewPercentage {
  part: number;
  total: number;
  percentage: string;
}

export interface StatisticsOverviewPeriod {
  maxDate: number;
  minDate: number;
}

export interface StatisticsMessageInteractionCounter {
  msgId: number;
  forwardsCount: number;
  viewsCount: number;
  reactionsCount: number;
}

export interface StatisticsStoryInteractionCounter {
  storyId: number;
  viewsCount: number;
  forwardsCount: number;
  reactionsCount: number;
}
