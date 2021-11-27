import { GroupCallParticipant, GroupCallConnectionState } from '../../lib/secret-sauce';

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
