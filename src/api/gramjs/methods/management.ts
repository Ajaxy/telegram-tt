import { Api as GramJs } from '../../../lib/gramjs';

import { invokeRequest } from './client';
import { buildInputEntity, buildInputPeer } from '../gramjsBuilders';
import { ApiChat, OnApiUpdate } from '../../types';

let onUpdate: OnApiUpdate;

export function init(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
}

export async function checkChatUsername(
  { username }: { username: string },
) {
  try {
    const result = await invokeRequest(new GramJs.channels.CheckUsername({
      channel: new GramJs.InputChannelEmpty(),
      username,
    }), undefined, true);

    return result!;
  } catch (err) {
    return false;
  }
}

export async function setChatUsername(
  { chat, username }: { chat: ApiChat; username: string },
) {
  const result = await invokeRequest(new GramJs.channels.UpdateUsername({
    channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
    username,
  }));

  if (result) {
    onUpdate({
      '@type': 'updateChat',
      id: chat.id,
      chat: { username },
    });
  }
}

export async function updatePrivateLink(
  { chat }: { chat: ApiChat },
) {
  const result = await invokeRequest(new GramJs.messages.ExportChatInvite({
    peer: buildInputPeer(chat.id, chat.accessHash),
  }));

  if (!result || !(result instanceof GramJs.ChatInviteExported)) {
    return;
  }

  onUpdate({
    '@type': 'updateChatFullInfo',
    id: chat.id,
    fullInfo: {
      inviteLink: result.link,
    },
  });
}
