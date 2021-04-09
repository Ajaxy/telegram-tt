import { invokeRequest } from './client';
import { Api as GramJs } from '../../../lib/gramjs';
import { buildInputPeer } from '../gramjsBuilders';

export function init() {
}

export async function answerCallbackButton(
  {
    chatId, accessHash, messageId, data,
  }: {
    chatId: number; accessHash?: string; messageId: number; data: string;
  },
) {
  const result = await invokeRequest(new GramJs.messages.GetBotCallbackAnswer({
    peer: buildInputPeer(chatId, accessHash),
    msgId: messageId,
    data: Buffer.from(data),
  }));

  if (!result) {
    return undefined;
  }

  return result;
}
