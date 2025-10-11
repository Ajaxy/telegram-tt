import type Api from './tl/api';

export type Entity = Api.TypeUser | Api.TypeChat;
export type FullEntity =
  | Api.UserFull
  | Api.messages.ChatFull
  | Api.ChatFull
  | Api.ChannelFull;

export type EntityLike =
  | bigint
  | string
  | Api.TypePeer
  | Api.TypeInputPeer
  | Entity
  | FullEntity
  | Api.TypeInputChannel
  | Api.TypeInputUser;

export interface SessionData {
  mainDcId: number;
  keys: Record<number, string>;
  isTest?: true;
}
