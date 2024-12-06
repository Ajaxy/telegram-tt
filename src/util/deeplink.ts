import { getActions } from '../global';

import type { ApiChatType, ApiFormattedText } from '../api/types';
import type { DeepLinkMethod, PrivateMessageLink } from './deepLinkParser';

import { API_CHAT_TYPES, RE_TG_LINK } from '../config';
import { toChannelId } from '../global/helpers';
import { tryParseDeepLink } from './deepLinkParser';

export const processDeepLink = (url: string): boolean => {
  const actions = getActions();

  const parsedLink = tryParseDeepLink(url);
  if (parsedLink) {
    switch (parsedLink.type) {
      case 'privateMessageLink':
        handlePrivateMessageLink(parsedLink, actions);
        return true;
      case 'publicUsernameOrBotLink': {
        const choose = parseChooseParameter(parsedLink.choose);

        actions.openChatByUsername({
          username: parsedLink.username,
          startParam: parsedLink.start,
          text: parsedLink.text,
          startApp: parsedLink.startApp,
          mode: parsedLink.mode,
          startAttach: parsedLink.startAttach,
          attach: parsedLink.attach,
          choose,
          originalParts: [parsedLink.username, parsedLink.appName],
        });
        return true;
      }
      case 'businessChatLink':
        actions.resolveBusinessChatLink({
          slug: parsedLink.slug,
        });
        return true;
      case 'premiumReferrerLink':
        actions.openPremiumModal();
        return true;
      case 'premiumMultigiftLink':
        actions.openGiftRecipientPicker();
        return true;
      default:
        break;
    }
  }

  if (!url.match(RE_TG_LINK)) {
    return false;
  }

  const {
    protocol, searchParams, hostname,
  } = new URL(url);

  if (protocol !== 'tg:') return false;

  const method = hostname as DeepLinkMethod;
  const params = Object.fromEntries(searchParams);

  const {
    checkChatInvite,
    openChatByUsername,
    openChatByPhoneNumber,
    openStickerSet,
    joinVoiceChatByLink,
    openInvoice,
    openChatWithDraft,
    checkChatlistInvite,
    openStoryViewerByUsername,
    processBoostParameters,
    checkGiftCode,
    openStarsBalanceModal,
  } = actions;

  switch (method) {
    case 'resolve': {
      const {
        domain, phone, post, comment, voicechat, livestream, start, startattach, attach, thread, topic,
        appname, startapp, mode, story, text,
      } = params;

      const hasBoost = params.hasOwnProperty('boost');
      const threadId = Number(thread) || Number(topic) || undefined;

      if (domain !== 'telegrampassport') {
        if (appname) {
          openChatByUsername({
            username: domain,
            startApp: startapp,
            mode,
            originalParts: [domain, appname],
            text,
          });
        } else if (params.hasOwnProperty('voicechat') || params.hasOwnProperty('livestream')) {
          joinVoiceChatByLink({
            username: domain,
            inviteHash: voicechat || livestream,
          });
        } else if (hasBoost) {
          processBoostParameters({ usernameOrId: domain });
        } else if (phone) {
          openChatByPhoneNumber({
            phoneNumber: phone,
            startAttach: startattach,
            attach,
            text,
          });
        } else if (story) {
          openStoryViewerByUsername({ username: domain, storyId: Number(story) });
        } else {
          openChatByUsername({
            username: domain,
            messageId: post ? Number(post) : undefined,
            commentId: comment ? Number(comment) : undefined,
            startParam: start,
            mode,
            startAttach: startattach,
            attach,
            threadId,
          });
        }
      }
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

      checkChatInvite({ hash: invite });
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
      openInvoice({ type: 'slug', slug });
      break;
    }

    case 'stars_topup': {
      const { balance, purpose } = params;
      const balanceNeeded = Number(balance);
      if (!balanceNeeded || balanceNeeded < 0) return true;

      openStarsBalanceModal({ topup: { balanceNeeded, purpose } });
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
      return false;
  }
  return true;
};

export function formatShareText(url?: string, text?: string, title?: string): ApiFormattedText {
  return {
    text: [url, title, text].filter(Boolean).join('\n'),
  };
}

function handlePrivateMessageLink(link: PrivateMessageLink, actions: ReturnType<typeof getActions>) {
  const {
    focusMessage,
    processBoostParameters,
  } = actions;
  const {
    isBoost, channelId, messageId, threadId,
  } = link;
  if (isBoost) {
    processBoostParameters({ usernameOrId: channelId, isPrivate: true });
    return;
  }
  focusMessage({
    chatId: toChannelId(channelId),
    threadId,
    messageId,
  });
}

function parseChooseParameter(choose?: string) {
  if (!choose) return undefined;
  const types = choose.toLowerCase().split(' ');
  return types.filter((type): type is ApiChatType => API_CHAT_TYPES.includes(type as ApiChatType));
}
