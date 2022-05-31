import type { Api as GramJs } from '../../lib/gramjs';
import type { ApiMessage } from '../types';

interface LocalDb {
  localMessages: Record<string, ApiMessage>;
  // Used for loading avatars and media through in-memory Gram JS instances.
  chats: Record<string, GramJs.Chat | GramJs.Channel>;
  users: Record<string, GramJs.User>;
  messages: Record<string, GramJs.Message | GramJs.MessageService>;
  documents: Record<string, GramJs.Document>;
  stickerSets: Record<string, GramJs.StickerSet>;
  photos: Record<string, GramJs.Photo>;
  webDocuments: Record<string, GramJs.TypeWebDocument>;
}

const LOCAL_DB_INITIAL = {
  localMessages: {},
  chats: {},
  users: {},
  messages: {},
  documents: {},
  stickerSets: {},
  photos: {},
  webDocuments: {},
};

const localDb: LocalDb = LOCAL_DB_INITIAL;

export default localDb;

export function clearLocalDb() {
  Object.assign(localDb, LOCAL_DB_INITIAL);
}
