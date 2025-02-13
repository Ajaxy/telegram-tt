import { getActions } from '../global';

import type { ApiChatType, ApiFormattedText } from '../api/types';
import type { DeepLinkMethod } from './deepLinkParser';

import { API_CHAT_TYPES, RE_TG_LINK } from '../config';
import { tryParseDeepLink } from './deepLinkParser';
import { IS_BAD_URL_PARSER } from './windowEnvironment';

export const processDeepLink = (url: string): boolean => {
  const actions = getActions();

  const parsedLink = tryParseDeepLink(url);
  if (parsedLink) {
    switch (parsedLink.type) {
      case 'privateMessageLink':
        actions.openPrivateChannel({
          id: parsedLink.channelId,
          threadId: parsedLink.threadId,
          messageId: parsedLink.messageId,
          commentId: parsedLink.commentId,
        });
        return true;
      case 'publicMessageLink': {
        actions.openChatByUsername({
          username: parsedLink.username,
          threadId: parsedLink.threadId,
          messageId: parsedLink.messageId,
          commentId: parsedLink.commentId,
        });
        return true;
      }
      case 'publicUsernameOrBotLink': {
        const choose = parseChooseParameter(parsedLink.choose);

        actions.openChatByUsername({
          username: parsedLink.username,
          startParam: parsedLink.start,
          ref: parsedLink.ref,
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
      case 'privateChannelLink': {
        actions.openPrivateChannel({
          id: parsedLink.channelId,
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
      case 'chatBoostLink':
        actions.processBoostParameters({
          usernameOrId: (parsedLink.username || parsedLink.id)!,
          isPrivate: Boolean(parsedLink.id),
        });
        return true;
      case 'giftUniqueLink':
        actions.openUniqueGiftBySlug({ slug: parsedLink.slug });
        return true;
      default:
        break;
    }
  }

  if (!url.match(RE_TG_LINK)) {
    return false;
  }

  const urlToParse = IS_BAD_URL_PARSER ? url.replace(/^tg:\/\//, 'https://') : url;

  const {
    protocol, searchParams, hostname,
  } = new URL(urlToParse);

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
    checkGiftCode,
    openStarsBalanceModal,
  } = actions;

  switch (method) {
    case 'resolve': {
      const {
        domain, phone, post, comment, voicechat, livestream, start, startattach, attach, thread, topic,
        appname, startapp, mode, story, text,
      } = params;

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

function parseChooseParameter(choose?: string) {
  if (!choose) return undefined;
  const types = choose.toLowerCase().split(' ');
  return types.filter((type): type is ApiChatType => API_CHAT_TYPES.includes(type as ApiChatType));
}
