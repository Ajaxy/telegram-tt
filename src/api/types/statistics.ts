import type { ApiChat } from './chats';
import type { ApiTypePrepaidGiveaway } from './payments';
import type { ApiTypeCurrencyAmount } from './stars';

export interface ApiChannelStatistics {
  type: 'channel';
  growthGraph?: TypeStatisticsGraph;
  followersGraph?: TypeStatisticsGraph;
  muteGraph?: TypeStatisticsGraph;
  topHoursGraph?: TypeStatisticsGraph;
  reactionsByEmotionGraph?: TypeStatisticsGraph;
  storyInteractionsGraph?: TypeStatisticsGraph;
  storyReactionsByEmotionGraph?: TypeStatisticsGraph;
  interactionsGraph: TypeStatisticsGraph;
  viewsBySourceGraph: TypeStatisticsGraph;
  newFollowersBySourceGraph: TypeStatisticsGraph;
  languagesGraph: TypeStatisticsGraph;
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

export interface ApiChannelMonetizationStatistics {
  topHoursGraph?: TypeStatisticsGraph;
  revenueGraph?: TypeStatisticsGraph;
  balances?: ChannelMonetizationBalances;
  usdRate?: number;
}

export interface ApiGroupStatistics {
  type: 'group';
  growthGraph?: TypeStatisticsGraph;
  membersGraph?: TypeStatisticsGraph;
  topHoursGraph?: TypeStatisticsGraph;
  languagesGraph: TypeStatisticsGraph;
  messagesGraph: TypeStatisticsGraph;
  actionsGraph: TypeStatisticsGraph;
  period: StatisticsOverviewPeriod;
  members: StatisticsOverviewItem;
  viewers: StatisticsOverviewItem;
  messages: StatisticsOverviewItem;
  posters: StatisticsOverviewItem;
}

export interface ApiPostStatistics {
  viewsGraph?: TypeStatisticsGraph;
  reactionsGraph?: TypeStatisticsGraph;
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
  prepaidGiveaways: ApiTypePrepaidGiveaway[];
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
  graphType: 'graph';
  type: string;
  zoomToken?: string;
  labelFormatter: string;
  tooltipFormatter: string;
  labels: Array<string | number>;
  isStacked: boolean;
  isPercentage?: boolean;
  isCurrency?: boolean;
  currencyRate?: number;
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

export interface StatisticsGraphError {
  graphType: 'error';
  error: string;
}

export interface StatisticsGraphAsync {
  graphType: 'async';
  token: string;
}

export type TypeStatisticsGraph = StatisticsGraph | StatisticsGraphError | StatisticsGraphAsync;

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
  type: 'message';
  msgId: number;
  forwardsCount: number;
  viewsCount: number;
  reactionsCount: number;
}

export interface StatisticsStoryInteractionCounter {
  type: 'story';
  storyId: number;
  viewsCount: number;
  forwardsCount: number;
  reactionsCount: number;
}

export interface ChannelMonetizationBalances {
  currentBalance: ApiTypeCurrencyAmount;
  availableBalance: ApiTypeCurrencyAmount;
  overallRevenue: ApiTypeCurrencyAmount;
  isWithdrawalEnabled?: boolean;
}
