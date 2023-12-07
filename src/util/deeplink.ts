import { getActions } from '../global';

import type { ApiChatType } from '../api/types';
import type { DeepLinkMethod } from './deepLinkParser';

import { API_CHAT_TYPES } from '../config';
import { IS_SAFARI } from './windowEnvironment';

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
    checkChatlistInvite,
    openStoryViewerByUsername,
    processBoostParameters,
    checkGiftCode,
  } = getActions();

  // Safari thinks the path in tg://path links is hostname for some reason
  const method = (IS_SAFARI ? hostname : pathname).replace(/^\/\//, '') as DeepLinkMethod;
  const params = Object.fromEntries(searchParams);

  switch (method) {
    case 'resolve': {
      const {
        domain, phone, post, comment, voicechat, livestream, start, startattach, attach, thread, topic,
        appname, startapp, story,
      } = params;

      const hasStartAttach = params.hasOwnProperty('startattach');
      const hasStartApp = params.hasOwnProperty('startapp');
      const hasBoost = params.hasOwnProperty('boost');
      const choose = parseChooseParameter(params.choose);
      const threadId = Number(thread) || Number(topic) || undefined;

      if (domain !== 'telegrampassport') {
        if (appname) {
          openChatByUsername({
            username: domain,
            startApp: startapp,
            originalParts: [domain, appname],
          });
        } else if ((hasStartAttach && choose) || (!appname && hasStartApp)) {
          processAttachBotParameters({
            username: domain,
            filter: choose,
            startParam: startattach || startapp,
          });
        } else if (params.hasOwnProperty('voicechat') || params.hasOwnProperty('livestream')) {
          joinVoiceChatByLink({
            username: domain,
            inviteHash: voicechat || livestream,
          });
        } else if (hasBoost) {
          processBoostParameters({ usernameOrId: domain });
        } else if (phone) {
          openChatByPhoneNumber({ phoneNumber: phone, startAttach: startattach, attach });
        } else if (story) {
          openStoryViewerByUsername({ username: domain, storyId: Number(story) });
        } else {
          openChatByUsername({
            username: domain,
            messageId: post ? Number(post) : undefined,
            commentId: comment ? Number(comment) : undefined,
            startParam: start,
            startAttach: startattach,
            attach,
            threadId,
          });
        }
      }
      break;
    }
    case 'privatepost': {
      const {
        post, channel,
      } = params;

      const hasBoost = params.hasOwnProperty('boost');

      if (hasBoost) {
        processBoostParameters({ usernameOrId: channel, isPrivate: true });
        return;
      }

      focusMessage({
        chatId: `-${channel}`,
        messageId: Number(post),
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
    case 'addlist': {
      checkChatlistInvite({ slug: params.slug });
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

    case 'boost': {
      const { channel, domain } = params;
      const isPrivate = Boolean(channel);

      processBoostParameters({ usernameOrId: channel || domain, isPrivate });
      break;
    }

    case 'giftcode': {
      const { slug } = params;
      checkGiftCode({ slug });
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
