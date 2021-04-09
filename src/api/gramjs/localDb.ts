import { Api as GramJs } from '../../lib/gramjs';
import { ApiMessage } from '../types';

interface LocalDb {
  localMessages: Record<string, ApiMessage>;
  // Used for loading avatars and media through in-memory Gram JS instances.
  chats: Record<number, GramJs.Chat | GramJs.Channel>;
  users: Record<number, GramJs.User>;
  messages: Record<string, GramJs.Message>;
  documents: Record<string, GramJs.Document>;
  stickerSets: Record<string, GramJs.StickerSet>;
}

export default {
  localMessages: {},
  chats: {},
  users: {},
  messages: {},
  documents: {},
  stickerSets: {},
} as LocalDb;
