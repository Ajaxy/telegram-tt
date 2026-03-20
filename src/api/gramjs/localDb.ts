import { Api as GramJs } from '../../lib/gramjs';

import { DEBUG } from '../../config';
import { DATA_BROADCAST_CHANNEL_NAME } from '../../util/multiaccount';
import { throttle } from '../../util/schedulers';
import { omitVirtualClassFields } from './apiBuilders/helpers';

export type StoryRepairInfo = {
  type: 'story';
  peerId: string;
  id: number;
};

export type MessageRepairInfo = {
  type: 'message';
  peerId: string;
  id: number;
};

export type WebPageRepairInfo = {
  type: 'webPage';
  url: string;
};

export type RepairInfo = {
  localRepairInfo?: StoryRepairInfo | MessageRepairInfo | WebPageRepairInfo;
};

export interface LocalDb {
  // Used for loading avatars and media through in-memory Gram JS instances.
  chats: Record<string, GramJs.Chat | GramJs.Channel>;
  users: Record<string, GramJs.User>;
  documents: Record<string, GramJs.Document & RepairInfo>;
  stickerSets: Record<string, GramJs.StickerSet>;
  photos: Record<string, GramJs.Photo & RepairInfo>;
  webDocuments: Record<string, GramJs.TypeWebDocument>;
  commonBoxState: Record<string, number>;
  channelPtsById: Record<string, number>;
}

const channel = new BroadcastChannel(DATA_BROADCAST_CHANNEL_NAME);

let batchedUpdates: {
  name: string;
  prop: string;
  value: any;
}[] = [];
const throttledLocalDbUpdate = throttle(() => {
  channel.postMessage({
    type: 'localDbUpdate',
    batchedUpdates,
  });
  batchedUpdates = [];
}, 100);

function createProxy(name: string, object: any) {
  return new Proxy(object, {
    get(target, prop: string, value: any) {
      return Reflect.get(target, prop, value);
    },
    set(target, prop: string, value: any) {
      batchedUpdates.push({ name, prop, value });
      throttledLocalDbUpdate();
      return Reflect.set(target, prop, value);
    },
  });
}

function convertToVirtualClass(value: any): any {
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'object' && Object.keys(value).length === 1 && Object.keys(value)[0] === 'value') {
    return BigInt(value.value);
  }

  if (Array.isArray(value)) {
    return value.map(convertToVirtualClass);
  }

  if (typeof value !== 'object' || !('CONSTRUCTOR_ID' in value)) {
    return value;
  }
  const path = value.className.split('.');
  const VirtualClass = path.reduce((acc: any, field: string) => {
    return acc[field];
  }, GramJs);

  const valueOmited = omitVirtualClassFields(value);
  const valueConverted = Object.keys(valueOmited).reduce((acc, key) => {
    acc[key] = convertToVirtualClass(valueOmited[key]);
    return acc;
  }, {} as Record<string, any>);

  return new VirtualClass(valueConverted);
}

function createLocalDbInitial(initial?: LocalDb): LocalDb {
  return [
    'localMessages', 'chats', 'users', 'messages', 'documents', 'stickerSets', 'photos', 'webDocuments', 'stories',
    'commonBoxState', 'channelPtsById',
  ]
    .reduce((acc: Record<string, any>, key) => {
      const value = initial?.[key as keyof LocalDb] ?? {};
      const convertedValue = Object.keys(value).reduce((acc2, key2) => {
        if (key === 'commonBoxState' || key === 'channelPtsById') {
          const typedValue = value as Record<string, number>;
          acc2[key2] = typedValue[key2];
          return acc2;
        }

        acc2[key2] = convertToVirtualClass(value[key2]);
        return acc2;
      }, {} as Record<string, any>);

      acc[key] = createProxy(key, convertedValue);
      return acc;
    }, {} as LocalDb) as LocalDb;
}

const localDb: LocalDb = createLocalDbInitial();

export default localDb;

export function broadcastLocalDbUpdateFull() {
  if (!channel) return;

  channel.postMessage({
    type: 'localDbUpdateFull',
    localDb: Object.keys(localDb).reduce((acc: Record<string, any>, key) => {
      acc[key] = { ...localDb[key as keyof LocalDb] };
      return acc;
    }, {} as Record<string, any>),
  });
}

export function updateFullLocalDb(initial: LocalDb) {
  Object.assign(localDb, createLocalDbInitial(initial));
}

export function clearLocalDb() {
  Object.assign(localDb, createLocalDbInitial());
}

if (DEBUG) {
  (globalThis as any).getLocalDb = () => localDb;
}
