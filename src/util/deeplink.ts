import { getActions } from '../global';

import type { ApiChatType } from '../api/types';

import { API_CHAT_TYPES } from '../config';
import { IS_SAFARI } from './environment';

type DeepLinkMethod = 'resolve' | 'login' | 'passport' | 'settings' | 'join' | 'addstickers' | 'addemoji' |
'setlanguage' | 'addtheme' | 'confirmphone' | 'socks' | 'proxy' | 'privatepost' | 'bg' | 'share' | 'msg' | 'msg_url' |
'invoice';

export const processDeepLink = (url: string) => {
  const {
    protocol, searchParams, pathname, hostname,
  } = new URL(url);

  if (protocol !== 'tg:') return;

  const {
    openChatByInvite,
    openChatByUsername,
    openChatByPhoneNumber,
    openStickerSet,
    focusMessage,
    joinVoiceChatByLink,
    openInvoice,
    processAttachBotParameters,
    openChatWithDraft,
  } = getActions();

  // Safari thinks the path in tg://path links is hostname for some reason
  const method = (IS_SAFARI ? hostname : pathname).replace(/^\/\//, '') as DeepLinkMethod;
  const params = Object.fromEntries(searchParams);

  switch (method) {
    case 'resolve': {
      const {
        domain, phone, post, comment, voicechat, livestream, start, startattach, attach,
      } = params;

      const startAttach = params.hasOwnProperty('startattach') && !startattach ? true : startattach;
      const choose = parseChooseParameter(params.choose);

      if (domain !== 'telegrampassport') {
        if (startAttach && choose) {
          processAttachBotParameters({
            username: domain,
            filter: choose,
            ...(typeof startAttach === 'string' && { startParam: startAttach }),
          });
        } else if (params.hasOwnProperty('voicechat') || params.hasOwnProperty('livestream')) {
          joinVoiceChatByLink({
            username: domain,
            inviteHash: voicechat || livestream,
          });
        } else if (phone) {
          openChatByPhoneNumber({ phone, startAttach, attach });
        } else {
          openChatByUsername({
            username: domain,
            messageId: Number(post),
            commentId: Number(comment),
            startParam: start,
            startAttach,
            attach,
          });
        }
      }
      break;
    }
    case 'privatepost': {
      const {
        post, channel,
      } = params;

      focusMessage({
        chatId: `-${channel}`,
        id: post,
      });
      break;
    }
    case 'bg': {
      // const {
      //   slug, color, rotation, mode, intensity, bg_color: bgColor, gradient,
      // } = params;
      break;
    }
    case 'join': {
      const { invite } = params;

      openChatByInvite({ hash: invite });
      break;
    }
    case 'addemoji':
    case 'addstickers': {
      const { set } = params;

      openStickerSet({
        stickerSetInfo: {
          shortName: set,
        },
      });
      break;
    }
    case 'share':
    case 'msg':
    case 'msg_url': {
      const { url: urlParam, text } = params;
      openChatWithDraft({ text: formatShareText(urlParam, text) });
      break;
    }
    case 'login': {
      // const { code, token } = params;
      break;
    }

    case 'invoice': {
      const { slug } = params;
      openInvoice({ slug });
      break;
    }
    default:
      // Unsupported deeplink

      break;
  }
};

export function parseChooseParameter(choose?: string) {
  if (!choose) return undefined;
  const types = choose.toLowerCase().split(' ');
  return types.filter((type): type is ApiChatType => API_CHAT_TYPES.includes(type as ApiChatType));
}

export function formatShareText(url?: string, text?: string, title?: string): string {
  return [url, title, text].filter(Boolean).join('\n');
}
