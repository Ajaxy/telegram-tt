import { Api as GramJs } from '../../lib/gramjs';
import { ApiMessage } from '../types';

interface LocalDb {
  localMessages: Record<string, ApiMessage>;
  // Used for loading avatars and media through in-memory Gram JS instances.
  chats: Record<number, GramJs.Chat | GramJs.Channel>;
  users: Record<number, GramJs.User>;
  messages: Record<string, GramJs.Message | GramJs.MessageService>;
  documents: Record<string, GramJs.Document>;
  stickerSets: Record<string, GramJs.StickerSet>;
  photos: Record<string, GramJs.Photo>;
  webDocuments: Record<string, GramJs.TypeWebDocument>;
}

export default {
  localMessages: {},
  chats: {},
  users: {},
  messages: {},
  documents: {},
  stickerSets: {},
  photos: {},
  webDocuments: {},
} as LocalDb;
