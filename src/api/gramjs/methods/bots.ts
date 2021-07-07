import { invokeRequest } from './client';
import { Api as GramJs } from '../../../lib/gramjs';
import { buildInputPeer } from '../gramjsBuilders';

export function init() {
}

export function answerCallbackButton(
  {
    chatId, accessHash, messageId, data,
  }: {
    chatId: number; accessHash?: string; messageId: number; data: string;
  },
) {
  return invokeRequest(new GramJs.messages.GetBotCallbackAnswer({
    peer: buildInputPeer(chatId, accessHash),
    msgId: messageId,
    data: Buffer.from(data),
  }));
}
