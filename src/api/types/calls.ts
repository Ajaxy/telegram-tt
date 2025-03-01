import type {
  ApiCallProtocol, ApiPhoneCallConnection,
  GroupCallConnectionState,
  GroupCallParticipant,
  VideoRotation,
  VideoState,
} from '../../lib/secret-sauce';

export interface ApiGroupCall {
  chatId?: string;
  isLoaded?: boolean;
  id: string;
  accessHash: string;
  joinMuted?: true;
  canChangeJoinMuted?: true;
  canStartVideo?: true;
  joinDateAsc?: true;
  scheduleStartSubscribed?: true;
  participantsCount: number;
  params?: any;
  title?: string;
  streamDcId?: number;
  recordStartDate?: number;
  scheduleDate?: number;
  version: number;
  inviteHash?: string;

  nextOffset?: string;
  participants: Record<string, GroupCallParticipant>;
  connectionState: GroupCallConnectionState;
  isSpeakerDisabled?: boolean;
}

export interface ApiPhoneCall {
  state?: 'active' | 'waiting' | 'discarded' | 'requested' | 'accepted' | 'requesting';
  isConnected?: boolean;
  id: string;
  accessHash?: string;
  adminId?: string;
  participantId?: string;
  isVideo?: boolean;
  isP2pAllowed?: boolean;
  date?: number;
  startDate?: number;
  receiveDate?: number;
  p2pAllowed?: boolean;
  connections?: ApiPhoneCallConnection[];
  protocol?: ApiCallProtocol;
  needRating?: boolean;
  needDebug?: boolean;
  reason?: 'missed' | 'disconnect' | 'hangup' | 'busy';
  duration?: number;

  emojis?: string;
  gA?: number[];
  gB?: number[];
  pLast?: number[];
  randomLast?: number[];
  gAOrB?: number[];
  gAHash?: number[];
  keyFingerprint?: string;

  isMuted?: boolean;
  videoState?: VideoState;
  videoRotation?: VideoRotation;
  screencastState?: VideoState;
  isBatteryLow?: boolean;
}

export type ApiPhoneCallDiscardReason = 'missed' | 'disconnect' | 'hangup' | 'busy';
