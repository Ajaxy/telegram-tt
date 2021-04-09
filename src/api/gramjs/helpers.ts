import { Api as GramJs } from '../../lib/gramjs';
import localDb from './localDb';
import { resolveMessageApiChatId } from './apiBuilders/messages';

export function addMessageToLocalDb(message: GramJs.Message) {
  const messageFullId = `${resolveMessageApiChatId(message)}-${message.id}`;
  localDb.messages[messageFullId] = message;
  if (
    message.media instanceof GramJs.MessageMediaDocument
    && message.media.document instanceof GramJs.Document
  ) {
    localDb.documents[String(message.media.document.id)] = message.media.document;
  }
}
