import type { ApiChat } from './chats';
import type { ApiMessage, ApiPhoto } from './messages';

export interface ApiChannelStatistics {
  growthGraph?: StatisticsGraph | string;
  followersGraph?: StatisticsGraph | string;
  muteGraph?: StatisticsGraph | string;
  topHoursGraph?: StatisticsGraph | string;
  interactionsGraph: StatisticsGraph | string;
  viewsBySourceGraph: StatisticsGraph | string;
  newFollowersBySourceGraph: StatisticsGraph | string;
  languagesGraph: StatisticsGraph | string;
  followers: StatisticsOverviewItem;
  viewsPerPost: StatisticsOverviewItem;
  sharesPerPost: StatisticsOverviewItem;
  enabledNotifications: StatisticsOverviewPercentage;
  recentTopMessages: Array<StatisticsRecentMessage | StatisticsRecentMessage & ApiMessage>;
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

export interface ApiMessageStatistics {
  viewsGraph?: StatisticsGraph | string;
  forwards?: number;
  views?: number;
  publicForwards?: number;
  publicForwardsData?: ApiMessagePublicForward[];
}

export interface ApiMessagePublicForward {
  messageId: number;
  views?: number;
  title?: string;
  chat: ApiChat;
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
  percentage: string;
}

export interface StatisticsOverviewPeriod {
  maxDate: number;
  minDate: number;
}

export interface StatisticsRecentMessage {
  msgId: number;
  forwards: number;
  views: number;
}
